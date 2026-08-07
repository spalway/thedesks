// Who is calling.
//
// Every writer added after the mint — profiles, the marketplace, the social
// layer, the SOL payout queue — has to answer "which wallet is acting?" without
// believing a request body. This module is the only place that answer is
// produced, and it produces exactly one thing: an `auth.users` id. The wallet is
// resolved from it in the DATABASE, by `public.actor_wallet`, and never travels
// over the wire.
//
// ---------------------------------------------------------------------------
// WHY THE USER ID IS FETCHED RATHER THAN DECODED
// ---------------------------------------------------------------------------
// The obvious implementation is to base64-decode the JWT payload and read `sub`.
// It is one line, it needs no network, and it is wrong in a way that only shows
// up later: it verifies nothing. `verify_jwt = true` in config.toml means the
// PLATFORM checked the signature before the function ran — but that is a
// deployment setting, in a file somebody can edit, and a function whose security
// depends on a toml flag being true is a function that becomes an open endpoint
// the day someone flips it to debug something.
//
// So the token is exchanged for a user at `/auth/v1/user`, which validates it
// server-side. One round trip per write, on paths that are already writing to
// Postgres. That is a cost worth paying for an identity that is checked here
// rather than assumed to have been checked upstream.
//
// ---------------------------------------------------------------------------
// THE ANON KEY IS A VALID JWT AND IS NOT A USER
// ---------------------------------------------------------------------------
// Every browser sends the anon key in `Authorization` — it is how PostgREST
// authenticates at all. It is a signed JWT with `role: anon` and no `sub`, so
// GoTrue answers it with a 401 and this module reports "not signed in". That is
// the correct outcome and it is the common one: a visitor who has not signed in
// with X can read everything and write nothing, which is the same boundary the
// RLS policies draw.
import { fnError, type FnError } from './http.ts'
import type { FunctionConfig } from './env.ts'

export interface Caller {
  /** The `auth.users` id. Passed to the database writers as `p_user_id`. */
  userId: string
  /** Present when the session signed in with X. Informational; the handle is never read from here. */
  hasTwitterIdentity: boolean
}

const NOT_SIGNED_IN =
  'This action needs a signed-in session. Sign in with X, link a wallet, and try again — nothing was written.'

/**
 * Resolves the request's bearer token to a user, or explains why it is nobody.
 *
 * Note what this deliberately does NOT do: it does not look at any field of the
 * request body. A caller cannot name themselves.
 */
export async function resolveCaller(
  config: FunctionConfig,
  request: Request,
): Promise<Caller | FnError> {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    return fnError('bad-request', NOT_SIGNED_IN)
  }

  let response: Response
  try {
    response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        // The apikey is the project's anon key requirement of the auth endpoint;
        // the bearer token is what actually identifies the user. The service-role
        // key is deliberately NOT used here — sending it would make GoTrue answer
        // about the service role rather than about the caller, and every request
        // would resolve to the same non-user.
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
      },
    })
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown error'
    return fnError('upstream', 'Could not reach the auth service to check this session.', detail)
  }

  if (!response.ok) {
    return fnError('bad-request', NOT_SIGNED_IN)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return fnError('upstream', 'The auth service returned an unreadable session.')
  }

  const user = body as { id?: unknown; identities?: unknown } | null
  const userId = typeof user?.id === 'string' ? user.id : ''
  if (!userId) {
    return fnError('bad-request', NOT_SIGNED_IN)
  }

  const identities = Array.isArray(user?.identities) ? user.identities : []
  const hasTwitterIdentity = identities.some(
    (i) => typeof i === 'object' && i !== null && (i as { provider?: unknown }).provider === 'twitter',
  )

  return { userId, hasTwitterIdentity }
}

/**
 * The shape every writer in these functions returns from the database.
 *
 * The SQL writers return jsonb with `ok` plus a `code` and a `message` on a
 * refusal, rather than raising — a refusal is an ordinary outcome the UI renders
 * as a sentence, and raising would also roll back the counter updates a refusal
 * is supposed to record. This turns that convention into an FnError at the HTTP
 * boundary so a client branches on one error shape everywhere.
 */
export interface WriterResult {
  ok?: unknown
  code?: unknown
  message?: unknown
  [key: string]: unknown
}

/**
 * Maps a database refusal onto the HTTP vocabulary.
 *
 * The distinction that matters is 'busy' versus 'rejected': a cooldown or a full
 * window is a 429 and means "try again shortly", while a malformed request or an
 * unowned asset is a 4xx that will never succeed. A client that retries the first
 * and gives up on the second needs the codes to tell them apart.
 */
const BUSY_CODES: ReadonlySet<string> = new Set([
  'cooldown',
  'wallet-window',
  'global-window',
  'mint-paused',
  'already-open',
])

export function writerRefusal(result: WriterResult): FnError | null {
  if (result?.ok === true) return null
  const code = typeof result?.code === 'string' ? result.code : 'rejected'
  const message =
    typeof result?.message === 'string'
      ? result.message
      : 'The database refused that action and wrote nothing.'
  return fnError(BUSY_CODES.has(code) ? 'busy' : 'rejected', message, code)
}
