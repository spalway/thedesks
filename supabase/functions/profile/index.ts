// profile — the user-typed half of an identity.
//
// Handle, bio, avatar. That is the whole surface, and the omission is the point:
// THERE IS NO WAY TO SET AN X HANDLE HERE. Not an ignored field, not a validated
// one — the body is read for exactly three keys and `public.set_profile` has no
// twitter parameter to forward one to even if this file wanted to.
//
// An X handle reaches a profile down exactly one path: `link-wallet`, after
// GoTrue has completed the OAuth exchange, reading the handle out of
// `auth.identities`. `profiles_twitter_is_verified` in the schema refuses a row
// where a handle exists without a provider id, a verification timestamp and an
// auth user, so even a service-role INSERT cannot write a claim somebody typed.
//
// Three layers for one rule, again, because a rule with one enforcement point is
// a rule that survives until somebody edits that point.
//
// The wallet is resolved from the session. A caller cannot edit a profile that is
// not theirs, and there is no parameter through which they could try.
import { callRpc } from '../_shared/db.ts'
import { loadPlatformConfig } from '../_shared/env.ts'
import { resolveCaller, writerRefusal, type WriterResult } from '../_shared/auth.ts'
import { errorResponse, fnError, isFnError, jsonResponse, readJsonBody, serveSafely } from '../_shared/http.ts'

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadPlatformConfig()
  if (isFnError(config)) return errorResponse(config)

  const caller = await resolveCaller(config, request)
  if (isFnError(caller)) return errorResponse(caller)

  // Refused rather than ignored. A client sending a handle is a client that
  // believes it can set one, and silently dropping the field would leave that
  // belief intact until somebody built a settings page around it.
  if ('twitter' in body || 'twitterHandle' in body || 'twitter_handle' in body) {
    return errorResponse(
      fnError(
        'bad-request',
        'An X handle cannot be set here. It is copied from a verified X sign-in by link-wallet, and no endpoint accepts a typed one. Nothing was saved.',
      ),
    )
  }

  const handle = typeof body.handle === 'string' ? body.handle.trim() : null
  const bio = typeof body.bio === 'string' ? body.bio.trim() : null

  // An avatar id has to be an integer. `Number()` on a string that is not one
  // yields NaN, which Postgres would reject with a type error rather than a
  // sentence — so the shape is checked here and the OWNERSHIP is checked in SQL,
  // where the answer cannot be stale.
  let avatar: number | null = null
  if (body.avatarXployeeId !== undefined && body.avatarXployeeId !== null) {
    const raw = body.avatarXployeeId
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) {
      return errorResponse(fnError('bad-request', '`avatarXployeeId` is a serial, as a non-negative integer.'))
    }
    avatar = raw
  }

  const result = await callRpc<WriterResult>(config, 'set_profile', {
    p_user_id: caller.userId,
    p_handle: handle,
    p_bio: bio,
    p_avatar_xployee_id: avatar,
  })
  if (isFnError(result)) return errorResponse(result)

  const refusal = writerRefusal(result)
  if (refusal) return errorResponse(refusal)

  return jsonResponse({ ok: true, wallet: result.wallet, handle: result.handle })
}))
