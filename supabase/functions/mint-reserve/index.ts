// mint-reserve — take the mint rate limit and hold a serial, BEFORE anything is
// burned.
//
// ===========================================================================
// THIS IS THE RATE LIMIT. THE BURN COMES AFTER IT.
// ===========================================================================
// A limit checked when a burn is indexed is checked after the tokens are already
// gone: it cannot prevent anything, it can only decide whether to hand over an
// xployee for money that has already been destroyed. So the budget is taken here,
// first, and `ingest-signature` redeems what this function granted.
//
// The enforcement is not in this file. Every threshold, every counter and every
// lock lives in `public.reserve_mint` — one SQL function, one advisory lock, a
// partial unique index per wallet, and a `for update skip locked` deal off the
// reveal pool. That is deliberate: an Edge Function cannot see the other Edge
// Function invocations running beside it, so a limit implemented here would be a
// limit two simultaneous requests could both pass. Postgres can see all of them.
//
// What this file does is exactly three things: work out who is asking, ask the
// database, and turn the answer into an HTTP status a client can act on.
//
// ===========================================================================
// THE WALLET IS NOT A PARAMETER
// ===========================================================================
// It is resolved from the session through `public.actor_wallet`, so a caller
// cannot spend somebody else's budget or park a reservation on a wallet they do
// not control. That matters more here than almost anywhere: a reservation holds a
// serial out of circulation, so an unauthenticated version of this endpoint would
// let anyone freeze the rare end of the collection for the length of the TTL,
// repeatedly, for free.
//
// ===========================================================================
// A REFUSAL IS NOT AN ERROR
// ===========================================================================
// "You reserved one 40 seconds ago" and "the protocol is at its hourly ceiling"
// are answers, not failures. They come back as a 429 with a sentence and a
// `retryAfterSeconds`, so a client renders a countdown rather than a red box.
// Only a malformed request or a broken database is a real error here.
import { callRpc } from '../_shared/db.ts'
import { loadPlatformConfig } from '../_shared/env.ts'
import { resolveCaller, writerRefusal, type WriterResult } from '../_shared/auth.ts'
import {
  errorResponse,
  fnError,
  isFnError,
  jsonResponse,
  readJsonBody,
  serveSafely,
} from '../_shared/http.ts'

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadPlatformConfig()
  if (isFnError(config)) return errorResponse(config)

  const caller = await resolveCaller(config, request)
  if (isFnError(caller)) return errorResponse(caller)

  const action = typeof body.action === 'string' ? body.action : 'reserve'

  // ---- check: read-only, costs no budget --------------------------------
  //
  // Separate from 'reserve' rather than folded into it, and the split is the
  // same one `spl.ts` draws between building a transaction and sending one: a
  // page that polls "can I mint?" must not be able to consume a reservation by
  // rendering.
  if (action === 'check') {
    const wallet = await callRpc<string | null>(config, 'actor_wallet', { p_user_id: caller.userId })
    if (isFnError(wallet)) return errorResponse(wallet)

    const availability = await callRpc<Record<string, unknown>>(config, 'mint_availability', {
      p_wallet: wallet ?? null,
    })
    if (isFnError(availability)) return errorResponse(availability)

    return jsonResponse({ ok: true, action: 'check', wallet: wallet ?? null, availability })
  }

  if (action === 'release') {
    const reservationId = typeof body.reservationId === 'string' ? body.reservationId.trim() : ''
    if (!reservationId) {
      return errorResponse(fnError('bad-request', 'Post the `reservationId` to release.'))
    }
    const wallet = await callRpc<string | null>(config, 'actor_wallet', { p_user_id: caller.userId })
    if (isFnError(wallet)) return errorResponse(wallet)
    if (!wallet) {
      return errorResponse(fnError('rejected', 'This session has no linked wallet. Nothing was changed.'))
    }

    const released = await callRpc<WriterResult>(config, 'release_mint_reservation', {
      p_wallet: wallet,
      p_reservation_id: reservationId,
    })
    if (isFnError(released)) return errorResponse(released)
    const refusal = writerRefusal(released)
    if (refusal) return errorResponse(refusal)

    // Said out loud in the response, because a client offering a "cancel" button
    // has to be able to explain what it costs. Releasing returns the serial to
    // the pool immediately; it does NOT refund the budget, because a refund would
    // make reserve/cancel/reserve a free way to reroll until a rare serial came
    // up, and the reveal order is a lottery.
    return jsonResponse({
      ok: true,
      action: 'release',
      budgetRefunded: false,
      note: 'The serial is back in the pool. This reservation still counts against the mint window — releasing is not a reroll.',
    })
  }

  if (action !== 'reserve') {
    return errorResponse(fnError('bad-request', '`action` must be "reserve", "check" or "release".'))
  }

  // ---- reserve ------------------------------------------------------------
  const wallet = await callRpc<string | null>(config, 'actor_wallet', { p_user_id: caller.userId })
  if (isFnError(wallet)) return errorResponse(wallet)
  if (!wallet) {
    return errorResponse(
      fnError(
        'rejected',
        'This session has no linked wallet, so there is nothing to reserve a serial for. Link a wallet first — nothing was written.',
      ),
    )
  }

  const result = await callRpc<WriterResult>(config, 'reserve_mint', { p_wallet: wallet })
  if (isFnError(result)) return errorResponse(result)

  const refusal = writerRefusal(result)
  if (refusal) {
    // A refusal keeps its retry hint. `retry_after_seconds` is computed in SQL
    // from the same clock the limit is enforced against, so a client counting
    // down from it cannot come back early.
    const retry = typeof result.retry_after_seconds === 'number' ? result.retry_after_seconds : undefined
    return new Response(
      JSON.stringify({ ok: false, error: refusal, retryAfterSeconds: retry }),
      {
        status: refusal.code === 'busy' ? 429 : 422,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Content-Type': 'application/json',
          ...(retry === undefined ? {} : { 'Retry-After': String(retry) }),
        },
      },
    )
  }

  return jsonResponse({
    ok: true,
    action: 'reserve',
    wallet,
    // True when the caller already held a live reservation and this call handed
    // the same one back. A retry, a refresh or a lost response must not consume a
    // second serial, so idempotency is reported rather than hidden.
    reused: result.reused === true,
    reservation: result.reservation ?? null,
    poolRemaining: result.pool_remaining ?? null,
    // The burn the client now has to build. Stated so nothing has to guess, and
    // deliberately WITHOUT an amount: the amount belongs to src/lib/spl.ts, which
    // reads the mint's real decimals off the mint account. A number here would be
    // a second copy of the price, and two copies of a price disagree eventually.
    next: 'Build the burn with buildMintTransaction() in src/lib/spl.ts, send it, then post the signature to ingest-signature.',
  })
}))
