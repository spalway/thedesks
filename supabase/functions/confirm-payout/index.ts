// confirm-payout — moves pending payout rows to their settled state.
//
// THE RULE THIS FUNCTION EXISTS TO HONOUR: a timeout leaves the row pending.
// Never failed. Ever.
//
// A claim is an irreversible transfer of real money out of a treasury whose only
// lock is a private key. If a claim that actually landed is shown as failed, the
// operator's obvious next move is to claim again — and the second claim is not a
// retry, it is a second withdrawal. "I don't know yet" and "it didn't happen" are
// different answers, and this function is careful never to confuse them.
//
// THE ONLY EVIDENCE OF ABSENCE THAT COUNTS IS BLOCKHEIGHT EXPIRY.
//
// A Solana transaction carries a recent blockhash and can only be included while
// that blockhash is within the validator's ~150-block window. `request-payout`
// stamps each row with the height past which its blockhash is dead. So:
//
//   getSignatureStatus finds nothing  AND  current height > expiry  →  it never
//   landed, and it now never can. That is a fact about the chain, not a timeout.
//
// Every other absence is silence: RPC unreachable, status cache miss, node behind,
// 'processed' only, a transaction we could not read back. All of those leave the
// row exactly as pending as it really is.
//
// The rule is enforced structurally rather than by discipline. The database
// exposes two functions: settle_payout, which can only write 'confirmed' or
// 'failed', and touch_payout, which can only move last_checked_at. Every unknown
// outcome below calls touch_payout — a function with no ability to change status
// at all — so the pending path cannot be miswritten into a settlement.
//
// A row reaches 'failed' in exactly three situations. One is the expiry above.
// The other two are not absences of information; they are the chain answering:
//
//   * The transaction landed and errored. It is on the ledger, and it moved
//     nothing. This is not "did not land" — it is "landed and reverted" — and
//     leaving it pending forever would be pretending not to have been told.
//   * The transaction landed, succeeded, and contains no treasury→dev-wallet
//     transfer of $xNFT. The signature was never a claim. Note how narrow this
//     is: anything that makes the transaction merely *hard to read* resolves to
//     pending instead, because an unreadable claim and an absent one look
//     identical and demand opposite responses. "No transfer found" therefore
//     requires that every $xNFT movement in the transaction was attributed to an
//     owner — a node that did not report token-account owners produces an empty
//     match for a claim that landed perfectly well, and `readClaim` refuses to
//     read that as a negative.
//
// And a row reaches 'confirmed' only from a verified reading. `settle_payout`
// refuses a confirmation with no amount, and the amount comes out of the
// transaction's own token balance deltas — never from the number the claim asked
// for, which is stored separately and marked unverified for exactly this reason.
//
// Runs two ways: POST {signature} to settle one row after a claim, or POST {} to
// sweep. The sweep is what stops a row hanging forever when the browser is closed
// mid-claim; see supabase/README.md for the pg_cron wiring.
import { isValidSignature } from '../_shared/base58.ts'
import { callRpc, selectRows, type PayoutRow } from '../_shared/db.ts'
import { loadConfig, type FunctionConfig } from '../_shared/env.ts'
import { errorResponse, fnError, isFnError, jsonResponse, readJsonBody, serveSafely } from '../_shared/http.ts'
import { getBlockHeight, getSignatureStatus } from '../_shared/rpc.ts'
import { netChangeFor, ownersFullyAttributed, readTransfers, transfersOfMint } from '../_shared/transfers.ts'

/** One invocation's worth of sweeping. Bounded so a backlog cannot blow the wall clock. */
const SWEEP_LIMIT = 50

type Resolution = 'confirmed' | 'failed' | 'pending'

interface Settlement {
  signature: string
  resolution: Resolution
  /** Why the row stayed pending, or why it failed. Absent on a clean confirm. */
  note?: string
}

/** Only the columns the settlement decision reads. */
interface PendingRow {
  signature: string
  expires_at_block_height: number
}

/**
 * Reads the claim back out of the transaction: how much $xNFT actually left the
 * treasury and reached the dev wallet.
 *
 * 'unreadable' is a first-class outcome and the caller must treat it as "leave it
 * pending", not as "there was no claim". A node that failed to parse an
 * instruction, a fetch that timed out, a transaction returned without metadata —
 * all of those look exactly like an absent transfer from here, and confirming or
 * failing on them would be settling a row on the strength of not having looked.
 *
 * 'absent' is correspondingly narrow, and narrower than it used to be: it means
 * the transaction was read completely, every $xNFT movement in it was attributed
 * to an owner, and none of them went from the treasury to the dev wallet. An
 * unattributed movement is 'unreadable', not 'absent'.
 */
async function readClaim(
  config: FunctionConfig,
  signature: string,
): Promise<{ amount: bigint; destination: string } | 'absent' | 'unreadable'> {
  const reading = await readTransfers(config.rpcUrl, signature)
  if (isFnError(reading)) {
    // A transaction that landed and errored is genuinely readable and genuinely
    // not a claim, but that case is decided from the signature status before this
    // function is reached — so every error here is an inability to read.
    return 'unreadable'
  }

  const legs = transfersOfMint(reading, config.xnftMint).filter(
    (leg) => leg.sourceOwner === config.treasury && leg.destinationOwner === config.devWallet,
  )

  if (legs.length === 0) {
    // NO MATCHING LEG IS NOT THE SAME AS NO CLAIM, and conflating the two is the
    // one mistake this file exists to never make.
    //
    // The filter above compares against `sourceOwner` and `destinationOwner`,
    // which are null whenever the RPC did not report a token account's owner —
    // optional metadata that older nodes omit. Every comparison against null
    // fails, so a claim that landed perfectly well on a node that did not resolve
    // owners produces exactly the same empty array as a transaction that moved
    // nothing. Returning 'absent' from that settled the row FAILED on the strength
    // of not having looked, which is the invitation to claim twice.
    //
    // So absence is only a fact when the attribution was complete.
    if (!ownersFullyAttributed(reading, config.xnftMint)) return 'unreadable'
    return 'absent'
  }

  // The reading of record is the balance delta, not the sum of the instructions.
  // Instructions say what was ordered; the delta says what the dev wallet is
  // actually holding that it was not before, across every account it owns of this
  // mint. If the two could disagree, the delta is the one that spent money.
  const received = netChangeFor(reading, config.xnftMint, config.devWallet)
  const sent = netChangeFor(reading, config.xnftMint, config.treasury)
  if (received === null || sent === null || received <= 0n || sent !== -received) {
    return 'unreadable'
  }

  return { amount: received, destination: config.devWallet }
}

async function settleOne(config: FunctionConfig, row: PendingRow): Promise<Settlement> {
  const signature = row.signature
  const status = await getSignatureStatus(config.rpcUrl, signature)

  if (isFnError(status)) {
    await callRpc(config, 'touch_payout', { p_signature: signature })
    return { signature, resolution: 'pending', note: 'Solana RPC was unreachable; status unknown.' }
  }

  if (status === null) {
    // Not in the status cache and not in transaction history, with
    // searchTransactionHistory on. The only question left is whether it could
    // still land, and the blockhash's expiry height answers it exactly.
    const height = await getBlockHeight(config.rpcUrl)
    if (isFnError(height)) {
      await callRpc(config, 'touch_payout', { p_signature: signature })
      return { signature, resolution: 'pending', note: 'Could not read the current block height; status unknown.' }
    }
    if (height <= row.expires_at_block_height) {
      await callRpc(config, 'touch_payout', { p_signature: signature })
      return {
        signature,
        resolution: 'pending',
        note: `Not seen yet, and its blockhash is valid until block ${row.expires_at_block_height}.`,
      }
    }

    const settled = await callRpc<PayoutRow>(config, 'settle_payout', {
      p_signature: signature,
      p_status: 'failed',
      p_failure_reason:
        `The transaction's blockhash expired at block ${row.expires_at_block_height} and the chain never saw it. ` +
        'It cannot land now. No $xNFT left the treasury.',
    })
    if (isFnError(settled)) {
      return { signature, resolution: 'pending', note: 'The database refused the settlement; row left pending.' }
    }
    return { signature, resolution: 'failed', note: 'Blockhash expired without the transaction landing.' }
  }

  if (status.err !== null && status.err !== undefined) {
    const settled = await callRpc<PayoutRow>(config, 'settle_payout', {
      p_signature: signature,
      p_status: 'failed',
      p_failure_reason: `The claim transaction failed on-chain: ${JSON.stringify(status.err).slice(0, 300)}`,
    })
    if (isFnError(settled)) {
      return { signature, resolution: 'pending', note: 'The database refused the settlement; row left pending.' }
    }
    return { signature, resolution: 'failed', note: 'The transaction landed and reverted. No $xNFT left the treasury.' }
  }

  // 'processed' is a single validator's opinion and can still be dropped. Only
  // 'confirmed' and above is treated as landed.
  if (status.confirmationStatus !== 'confirmed' && status.confirmationStatus !== 'finalized') {
    await callRpc(config, 'touch_payout', { p_signature: signature })
    return { signature, resolution: 'pending', note: 'Seen but not yet confirmed.' }
  }

  const claim = await readClaim(config, signature)

  if (claim === 'unreadable') {
    await callRpc(config, 'touch_payout', { p_signature: signature })
    return { signature, resolution: 'pending', note: 'Confirmed on-chain, but the transfer could not be read back.' }
  }

  if (claim === 'absent') {
    // Landed, succeeded, fully readable, and no $xNFT moved from the treasury to
    // the dev wallet. The chain has answered, and the answer is that this
    // signature was never a claim. Failing it is what keeps a junk row from
    // sitting in the queue forever pretending to be money in flight.
    const settled = await callRpc<PayoutRow>(config, 'settle_payout', {
      p_signature: signature,
      p_status: 'failed',
      p_failure_reason: 'That transaction confirmed but moved no $xNFT from the treasury to the dev wallet.',
    })
    if (isFnError(settled)) {
      return { signature, resolution: 'pending', note: 'The database refused the settlement; row left pending.' }
    }
    return { signature, resolution: 'failed', note: 'Not a treasury claim.' }
  }

  // The only place a payout amount is ever verified. `amount` is null on the row
  // until this line runs, and `amount_verified` is generated from that null — so
  // there is no state in which the ledger shows a number nothing checked.
  const settled = await callRpc<PayoutRow>(config, 'settle_payout', {
    p_signature: signature,
    p_status: 'confirmed',
    p_amount: claim.amount.toString(),
    p_destination: claim.destination,
  })
  if (isFnError(settled)) {
    return { signature, resolution: 'pending', note: 'The database refused the settlement; row left pending.' }
  }
  return { signature, resolution: 'confirmed' }
}

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadConfig()
  if (isFnError(config)) return errorResponse(config)

  // A claim is a transfer from the treasury to the dev wallet. Where those are
  // one address there is no transfer to read, and readClaim below cannot ever
  // return one: it requires `received > 0` and `sent === -received`, and with a
  // single wallet those are the same number, so only zero satisfies both and
  // zero is already refused. Left to run, every row would come back 'unreadable'
  // and be retried on every sweep, forever.
  //
  // Refusing here says so once, plainly, instead of burning RPC quota to
  // rediscover it. Fee revenue in this shape never moves — it is already in the
  // wallet that pays people.
  if (!config.sweepsFees) {
    return errorResponse(
      fnError(
        'not-configured',
        'The treasury and the dev wallet are the same address, so fees are never swept and there is no claim to confirm. Nothing was read.',
      ),
    )
  }

  const requested = typeof body.signature === 'string' ? body.signature.trim() : ''
  if (requested && !isValidSignature(requested)) {
    return errorResponse(fnError('bad-request', 'That is not a Solana transaction signature.'))
  }

  // Even a single-signature call is filtered through the pending set: a row that
  // is already settled must not be re-examined, because a later contradictory
  // read could otherwise overwrite a confirmed payout.
  // The sweep is least-recently-checked first, not oldest-first.
  //
  // `requested_at.asc` was a strict FIFO over a queue anyone holding the public
  // anon key can insert into, so fifty junk rows at the head of it would be
  // re-examined on every single invocation and a real payout behind them would
  // never be reached — starved indefinitely by rows that cost nothing to create.
  // Ordering by `last_checked_at` makes the queue round-robin instead: examining a
  // row moves it to the back, so every pending payout is reached within a bounded
  // number of sweeps no matter how many siblings it has. Nulls first keeps a row
  // nothing has looked at yet ahead of one that has been.
  const columns = 'select=signature,expires_at_block_height&status=eq.pending'
  const filter = requested
    ? `${columns}&signature=eq.${encodeURIComponent(requested)}`
    : `${columns}&order=last_checked_at.asc.nullsfirst,requested_at.asc&limit=${SWEEP_LIMIT}`

  const rows = await selectRows<PendingRow>(config, 'payouts', filter)
  if (isFnError(rows)) return errorResponse(rows)

  const settlements: Settlement[] = []
  for (const row of rows) {
    if (!row.signature || !Number.isFinite(row.expires_at_block_height)) continue
    settlements.push(await settleOne(config, row))
  }

  return jsonResponse({
    ok: true,
    checked: settlements.length,
    confirmed: settlements.filter((s) => s.resolution === 'confirmed').length,
    failed: settlements.filter((s) => s.resolution === 'failed').length,
    stillPending: settlements.filter((s) => s.resolution === 'pending').length,
    settlements,
  })
}))
