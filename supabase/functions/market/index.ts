// market — listing, cancelling, buying and renting.
//
// ===========================================================================
// EVERY ACTION HERE IS SIMULATED, AND EVERY ACTION HERE IS CHECKED
// ===========================================================================
// No token moves. There is no escrow program, so an atomic swap would need both
// parties to co-sign one transaction and nothing arranges that — a sale is a row
// in `public.trades` and a rental is a row in `public.rentals`.
//
// Simulated makes the checking MORE important rather than less, and that is worth
// being blunt about because the instinct runs the other way. A chain-backed row
// has a ledger behind it: if this index is wrong, the chain is right and the
// index gets rebuilt. A simulated row has nothing behind it. If it is wrong, it
// is wrong forever, and the wrongest thing it can be is "this xployee now belongs
// to somebody who did not own it".
//
// So: a seller must own what they list; a buyer cannot buy their own listing or
// one that has closed; the price is read off the listing rather than off the
// request. All of that is enforced in SQL under a row lock, not here — two Edge
// Function invocations cannot see each other, so a check written in this file
// would be a check two simultaneous buyers could both pass.
//
// ===========================================================================
// THE PRICE IS NEVER A PARAMETER
// ===========================================================================
// `buy_listing` and `rent_listing` take a serial and nothing else. A buyer who
// could send an amount would be writing the seller's proceeds — the same reason
// `request-payout` reads its destination from configuration instead of from the
// caller.
import { callRpc } from '../_shared/db.ts'
import { loadPlatformConfig } from '../_shared/env.ts'
import { resolveCaller, writerRefusal, type WriterResult } from '../_shared/auth.ts'
import { errorResponse, fnError, isFnError, jsonResponse, readJsonBody, serveSafely } from '../_shared/http.ts'

const U64 = /^(0|[1-9][0-9]{0,19})$/

function serialOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

/** Raw units as a decimal string. A JSON number would already have been through a double. */
function rawUnits(value: unknown): string | null {
  return typeof value === 'string' && U64.test(value) ? value : null
}

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadPlatformConfig()
  if (isFnError(config)) return errorResponse(config)

  const caller = await resolveCaller(config, request)
  if (isFnError(caller)) return errorResponse(caller)

  const action = typeof body.action === 'string' ? body.action : ''
  const xployeeId = serialOf(body.xployeeId)
  if (xployeeId === null) {
    return errorResponse(fnError('bad-request', 'Post the `xployeeId` as a non-negative integer serial.'))
  }

  let fn: string
  let args: Record<string, unknown>

  switch (action) {
    case 'list': {
      const kind = body.kind === 'sale' || body.kind === 'rent' ? body.kind : null
      if (kind === null) {
        return errorResponse(fnError('bad-request', '`kind` is "sale" or "rent".'))
      }

      // Amounts arrive as decimal strings and are forwarded as decimal strings.
      // They are never parsed into a number anywhere on this path: the u64_text
      // domain exists precisely so a raw amount can cross PostgREST without being
      // serialised as a JSON number, and parsing one here would undo that at the
      // first hop.
      const price = kind === 'sale' ? rawUnits(body.price) : null
      const feePerEpoch = kind === 'rent' ? rawUnits(body.feePerEpoch) : null
      const termEpochs =
        kind === 'rent' && typeof body.termEpochs === 'number' && Number.isInteger(body.termEpochs)
          ? body.termEpochs
          : null

      if (kind === 'sale' && price === null) {
        return errorResponse(fnError('bad-request', '`price` is raw units as a decimal string.'))
      }
      if (kind === 'rent' && (feePerEpoch === null || termEpochs === null)) {
        return errorResponse(
          fnError('bad-request', '`feePerEpoch` is raw units as a decimal string and `termEpochs` is an integer.'),
        )
      }

      fn = 'create_listing'
      args = {
        p_user_id: caller.userId,
        p_xployee_id: xployeeId,
        p_kind: kind,
        p_price: price,
        p_fee_per_epoch: feePerEpoch,
        p_term_epochs: termEpochs,
      }
      break
    }

    case 'cancel':
      fn = 'cancel_listing'
      args = { p_user_id: caller.userId, p_xployee_id: xployeeId }
      break

    // No amount, no price, no fee. Everything the transaction costs is read off
    // the listing inside the transaction that closes it.
    case 'buy':
      fn = 'buy_listing'
      args = { p_user_id: caller.userId, p_xployee_id: xployeeId }
      break

    case 'rent':
      fn = 'rent_listing'
      args = { p_user_id: caller.userId, p_xployee_id: xployeeId }
      break

    default:
      return errorResponse(fnError('bad-request', '`action` must be "list", "cancel", "buy" or "rent".'))
  }

  const result = await callRpc<WriterResult>(config, fn, args)
  if (isFnError(result)) return errorResponse(result)

  const refusal = writerRefusal(result)
  if (refusal) return errorResponse(refusal)

  return jsonResponse({
    ok: true,
    action,
    result,
    // Repeated on every response rather than documented once, because this is the
    // sentence a client is most likely to render something misleading around. A
    // "purchase" here settles no tokens; it is a ledger entry in a simulation.
    settlement: 'simulated',
  })
}))
