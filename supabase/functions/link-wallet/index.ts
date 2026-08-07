// link-wallet — proving that an X account and a Solana wallet are the same
// person.
//
// ===========================================================================
// BOTH SIDES, OR NEITHER
// ===========================================================================
// A link is a claim about two things at once, so one proof is not enough:
//
//   * proving only the X side lets anyone attach a stranger's wallet to their own
//     account and inherit its collection on every leaderboard;
//   * proving only the wallet side lets anyone attach a stranger's X handle to
//     their own wallet and impersonate them.
//
// So both are required in the same call:
//
//   X side      — a Supabase Auth session carrying a `twitter` identity. GoTrue
//                 completed the OAuth exchange with X and this function reads the
//                 handle out of `auth.identities`, never out of the request. That
//                 is the whole of "an X handle is stored only when it came from a
//                 verified identity": there is no parameter to put one in.
//   Wallet side — an ed25519 signature by the wallet's own key over a statement
//                 THIS SERVER issued, carrying a nonce THIS SERVER generated.
//
// ===========================================================================
// TWO CALLS, NOT ONE, AND WHY
// ===========================================================================
//   POST { action: 'challenge' }  -> a nonce and the exact text to sign
//   POST { action: 'verify', ... } -> the signature; the link is written
//
// The split exists because the nonce has to be issued before it is signed, by
// someone other than the signer. A single-call version would have to accept a
// client-chosen message, and a signature over a client-chosen message is a
// signature that could have been collected somewhere else entirely — from a
// phishing page, or from another dapp that asked the user to "verify ownership"
// last week — and replayed here.
//
// The challenge is single-use and consumed in the same database transaction that
// writes the link, so a replayed signature finds it spent.
//
// ===========================================================================
// WHAT THIS FUNCTION IS TRUSTED WITH, AND WHAT IT IS NOT
// ===========================================================================
// Postgres has no ed25519 primitive here, so `complete_wallet_link` cannot check
// the signature and does not pretend to. It checks everything else — that the
// challenge existed, was issued to this session for this wallet, has not expired
// or been used, and that the session really has a twitter identity — and it reads
// the handle itself. This function's single job is the arithmetic, and it fails
// closed on every path where it cannot do it (see _shared/ed25519.ts).
import { isValidAddress } from '../_shared/base58.ts'
import { callRpc } from '../_shared/db.ts'
import { loadPlatformConfig } from '../_shared/env.ts'
import { resolveCaller, writerRefusal, type WriterResult } from '../_shared/auth.ts'
import { freshNonce, linkStatement, verifyWalletSignature } from '../_shared/ed25519.ts'
import {
  errorResponse,
  fnError,
  isFnError,
  jsonResponse,
  readJsonBody,
  serveSafely,
} from '../_shared/http.ts'

/** Short. A challenge is something you answer in the next minute; a long-lived one is a longer window to obtain a signature by other means. */
const CHALLENGE_TTL_SECONDS = 300

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadPlatformConfig()
  if (isFnError(config)) return errorResponse(config)

  const caller = await resolveCaller(config, request)
  if (isFnError(caller)) return errorResponse(caller)

  const action = typeof body.action === 'string' ? body.action : ''

  // ---- unlink -------------------------------------------------------------
  if (action === 'unlink') {
    const result = await callRpc<WriterResult>(config, 'unlink_wallet', { p_user_id: caller.userId })
    if (isFnError(result)) return errorResponse(result)
    const refusal = writerRefusal(result)
    if (refusal) return errorResponse(refusal)
    return jsonResponse({ ok: true, action: 'unlink', wallet: result.wallet })
  }

  // Both remaining actions need the X side to already be proved. Checked here as
  // well as in SQL: a session with no twitter identity should be told that before
  // it is asked to sign anything, not after.
  if (!caller.hasTwitterIdentity) {
    return errorResponse(
      fnError(
        'rejected',
        'This session did not sign in with X, so there is no verified handle to link. Sign in with X first — nothing was written.',
      ),
    )
  }

  const wallet = typeof body.wallet === 'string' ? body.wallet.trim() : ''
  if (!isValidAddress(wallet)) {
    return errorResponse(fnError('bad-request', 'Post the `wallet` as a base58 Solana address.'))
  }

  // ---- challenge ----------------------------------------------------------
  if (action === 'challenge') {
    // The handle is read from the database's view of `auth.identities` rather
    // than from this function's copy of the session, so the statement the user
    // signs names the same handle the link will record.
    const handle = await callRpc<string | null>(config, 'twitter_handle_for_user', {
      p_user_id: caller.userId,
    })
    if (isFnError(handle)) return errorResponse(handle)
    if (!handle) {
      return errorResponse(
        fnError('rejected', 'This session has no X handle on record. Nothing was written.'),
      )
    }

    const nonce = freshNonce()
    const issuedAt = new Date().toISOString()
    const statement = linkStatement({ wallet, twitterHandle: handle, nonce, issuedAt })

    const issued = await callRpc<WriterResult>(config, 'issue_wallet_link_challenge', {
      p_user_id: caller.userId,
      p_wallet: wallet,
      p_nonce: nonce,
      p_statement: statement,
      p_ttl_seconds: CHALLENGE_TTL_SECONDS,
    })
    if (isFnError(issued)) return errorResponse(issued)
    const refusal = writerRefusal(issued)
    if (refusal) return errorResponse(refusal)

    return jsonResponse({
      ok: true,
      action: 'challenge',
      nonce,
      // The client signs THIS STRING, byte for byte. It is returned rather than
      // described so there is no template for the two sides to disagree about.
      statement,
      expiresInSeconds: CHALLENGE_TTL_SECONDS,
    })
  }

  // ---- verify -------------------------------------------------------------
  if (action !== 'verify') {
    return errorResponse(fnError('bad-request', '`action` must be "challenge", "verify" or "unlink".'))
  }

  const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : ''
  const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
  if (!nonce || !signature) {
    return errorResponse(fnError('bad-request', 'Post the `nonce` and the `signature` over the issued statement.'))
  }

  // The statement is fetched from the row that issued it, not rebuilt from the
  // request. A verifier that reconstructs the message from a template is a
  // verifier that can be handed a signature made over a different template.
  const challenge = await callRpc<{ statement?: unknown; wallet?: unknown } | null>(
    config,
    'wallet_link_challenge_statement',
    { p_user_id: caller.userId, p_nonce: nonce },
  )
  if (isFnError(challenge)) return errorResponse(challenge)

  const statement = typeof challenge?.statement === 'string' ? challenge.statement : ''
  if (!statement) {
    return errorResponse(
      fnError('rejected', 'That challenge does not exist, has expired, or was issued to a different session. Nothing was linked.'),
    )
  }
  if (challenge?.wallet !== wallet) {
    return errorResponse(
      fnError('rejected', 'That challenge was issued for a different wallet. Nothing was linked.'),
    )
  }

  const verified = await verifyWalletSignature(wallet, statement, signature)
  if (isFnError(verified)) return errorResponse(verified)
  if (!verified) {
    // A well-formed signature that does not check out. Distinct from a malformed
    // one above, because the two lead a user somewhere different: this one means
    // the wrong wallet signed.
    return errorResponse(
      fnError('rejected', 'That signature was not made by this wallet over the issued statement. Nothing was linked.'),
    )
  }

  const linked = await callRpc<WriterResult>(config, 'complete_wallet_link', {
    p_user_id: caller.userId,
    p_wallet: wallet,
    p_nonce: nonce,
    p_signature: signature,
  })
  if (isFnError(linked)) return errorResponse(linked)
  const refusal = writerRefusal(linked)
  if (refusal) return errorResponse(refusal)

  return jsonResponse({
    ok: true,
    action: 'verify',
    wallet: linked.wallet,
    twitterHandle: linked.twitter_handle,
  })
}))
