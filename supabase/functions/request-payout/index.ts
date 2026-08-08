// request-payout — records the pending row for a claim the operator has already
// signed and sent.
//
// WHAT THIS FUNCTION NO LONGER DOES. It used to assemble an unsigned Anchor
// `claim_fees` instruction: derive the config and treasury PDAs, hash a
// discriminator, lay out six accounts positionally, serialise, hand back base64.
// All of that is gone with the program. Building a claim is now two
// `transferChecked`-shaped lines in `src/lib/spl.ts` — `buildClaimTransaction`
// there — and it belongs on the client because the client is what holds the
// wallet. A backend that builds a transaction the operator then blind-signs is a
// backend the operator has to trust with the shape of their own withdrawal.
//
// So what is left is one job, and it is a bookkeeping job: write down that a
// claim is in flight, honestly, in a way a later chain reading can settle.
//
// THE ROW IS NOT ALLOWED TO ASSERT AN AMOUNT. The transaction has not landed. No
// amount has been verified by anything. So:
//
//   `claimed_amount_unverified`  ← what the client said it was claiming, stored
//                                  under a name that cannot be misread as truth,
//                                  and useful only for spotting a discrepancy
//                                  once the real number arrives.
//   `amount`                     ← NULL. Stays null until confirm-payout reads
//                                  the transfer off the chain. The database
//                                  refuses `status = 'confirmed'` while it is
//                                  null, so a verified amount is not a
//                                  convention here, it is a constraint.
//
// The destination is likewise never a parameter. It is read from
// DEV_WALLET_ADDRESS in the function's own environment, for the same reason
// `DEV_WALLET_ADDRESS` is a module constant rather than an argument in
// `src/lib/spl.ts` — a caller-supplied destination turns a payout record into a
// cover story for a transfer somewhere else. Be clear about the limit of that,
// though: nothing on-chain constrains where the treasury keypair can send fees.
// This column records where this deployment *says* fees go, and confirm-payout
// overwrites it with where they demonstrably went.
//
// WHAT THIS ENDPOINT CANNOT DO, AND HOW THE DAMAGE IS BOUNDED INSTEAD.
//
// There is no authorisation here and there is nowhere to get one. The anon key is
// compiled into the bundle and public by design, this app mints no sessions, and
// the only thing that could authorise a claim — the treasury keypair — never
// leaves the operator's wallet. So anyone who can read the page can POST a
// syntactically valid signature and have a `payouts` row written for it.
//
// Verifying the signature on the chain first is not available either, and the
// reason is the whole point of the endpoint: the transaction has not landed yet.
// That is precisely when the row has to exist, because a signature that is lost
// between the wallet returning it and the chain confirming it is a transfer
// nobody has a record of.
//
// What CAN be bounded is the consequence, and the consequence that mattered was
// starvation: `confirm-payout` sweeps pending rows a bounded number at a time, so
// an unbounded queue of junk pushes a real payout past the end of every sweep and
// it never settles. Two changes close that, and neither pretends to be
// authentication:
//
//   1. The queue has a ceiling (MAX_PENDING_ROWS below). One operator has at most
//      one unsettled claim at a time — `usePayouts` refuses to sign a second —
//      so the ceiling is generous by an order of magnitude and still turns
//      "unbounded rows" into "a handful".
//   2. Past the ceiling, a signature is admitted only if the chain has already
//      seen it. Made-up signatures never pass that, and every junk row already in
//      the queue is settled `failed` the moment its blockhash expires, so the
//      queue drains itself in minutes rather than filling forever.
//
// `confirm-payout` sweeps least-recently-checked first for the same reason, so
// even a full queue cannot park itself at the head of the FIFO and starve the row
// behind it.
//
// `expires_at_block_height` is read from RPC here rather than accepted from the
// client, and that is the whole basis of confirm-payout's only definite negative.
// A client-supplied expiry that was too low would let a caller manufacture a
// "definitely did not land" verdict for a transaction that is still perfectly
// alive. Reading a fresh blockhash a moment after the claim was built gives a
// height at or above the transaction's true expiry, so the error is always in the
// direction of waiting longer — which costs a pending row a few extra minutes and
// costs nobody a duplicate withdrawal.
import { isValidSignature } from '../_shared/base58.ts'
import { callRpc, selectRows, type PayoutRow } from '../_shared/db.ts'
import { loadConfig, type FunctionConfig } from '../_shared/env.ts'
import { errorResponse, fnError, isFnError, jsonResponse, readJsonBody, serveSafely, type FnError } from '../_shared/http.ts'
import { isStorableAmount } from '../_shared/protocol.ts'
import { getLatestBlockhash, getSignatureStatus } from '../_shared/rpc.ts'

const U64_DIGITS = /^(0|[1-9][0-9]{0,19})$/

/**
 * How many unsettled claims the queue will hold before it stops accepting
 * signatures the chain has not seen.
 *
 * One operator, one wallet, one claim at a time — `usePayouts` will not sign a
 * second while the first is unsettled — so the real number is 1 and anything
 * above it is slack for a browser that posted twice, a sweep that has not run
 * yet, and a claim left over from a previous session. Eight is deliberately
 * generous: the ceiling exists to make the queue finite, not to be reached.
 */
const MAX_PENDING_ROWS = 8

/** Digit strings only. A JSON number would already have been through a double. */
function parseU64(value: unknown): bigint | null {
  if (typeof value !== 'string' || !U64_DIGITS.test(value)) return null
  const parsed = BigInt(value)
  return isStorableAmount(parsed) ? parsed : null
}

/**
 * Decides whether this signature may take a place in the queue.
 *
 * Returns an FnError to refuse, or null to admit. The order of the checks is what
 * keeps the honest path free: a claim already on record never reaches the
 * ceiling, and a queue below the ceiling never costs an RPC call.
 */
async function admit(config: FunctionConfig, signature: string): Promise<FnError | null> {
  // Already recorded? Then this is a re-post, and it has to stay idempotent.
  // `usePayouts` keeps re-posting a signature until the index acknowledges it, so
  // refusing a retry on a full queue would strand a real, already-sent claim in
  // one browser's localStorage — the exact failure the pending row exists to
  // prevent. `signature` is unique, so this is an index lookup.
  const existing = await selectRows<{ signature: string }>(
    config,
    'payouts',
    `select=signature&signature=eq.${encodeURIComponent(signature)}&limit=1`,
  )
  if (isFnError(existing)) return existing
  if (existing.length > 0) return null

  const pending = await selectRows<{ signature: string }>(
    config,
    'payouts',
    `select=signature&status=eq.pending&limit=${MAX_PENDING_ROWS}`,
  )
  if (isFnError(pending)) return pending
  if (pending.length < MAX_PENDING_ROWS) return null

  // At the ceiling. The queue is only worth a place to a signature the chain can
  // corroborate, so ask it. This does NOT make the endpoint authenticated — any
  // landed transaction passes, and confirm-payout will settle one that is not a
  // claim as `failed` on its next sweep. What it does is deny an attacker the
  // cheap move: fabricated signatures cost nothing to generate and the chain has
  // never heard of any of them.
  const status = await getSignatureStatus(config.rpcUrl, signature)
  if (isFnError(status)) {
    // RPC is down and the queue is full. Refusing is the safe direction: the
    // signature stays in the browser's storage and the post is retried, whereas
    // admitting it would let an outage be the thing that lifts the ceiling.
    return fnError(
      'busy',
      'The payout queue is full and Solana RPC could not be reached to check this signature. Nothing was written; the claim is still on chain and this can be posted again.',
    )
  }
  if (status === null) {
    return fnError(
      'busy',
      `The payout queue already holds ${MAX_PENDING_ROWS} unsettled claims and the chain has not seen this signature yet. ` +
        'Nothing was written. Unsettled rows leave the queue as soon as confirm-payout settles them, and a signature that never lands is settled failed once its blockhash expires — post this again shortly.',
    )
  }
  return null
}

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const config = loadConfig()
  if (isFnError(config)) return errorResponse(config)

  // Refused at the door rather than recorded and then never confirmable. This
  // endpoint writes a pending row that confirm-payout is supposed to settle, and
  // with one wallet for both there is no sweep to settle — so accepting the post
  // would queue a row that can only ever sit pending. See the same guard in
  // confirm-payout for why a claim is unreadable in that shape.
  if (!config.sweepsFees) {
    return errorResponse(
      fnError(
        'not-configured',
        'The treasury and the dev wallet are the same address, so fees are never swept and there is no claim to record. Nothing was written.',
      ),
    )
  }

  // 'record' remains the only action, and 'build' is refused with a pointer
  // rather than a generic parse error — a client still calling it is a client
  // that has not been updated, and telling it where the builder went is more use
  // than telling it the word is wrong.
  const action = typeof body.action === 'string' ? body.action : 'record'
  if (action === 'build') {
    return errorResponse(
      fnError(
        'bad-request',
        'This backend no longer builds claim transactions. Build it in the browser with buildClaimTransaction() in src/lib/spl.ts, send it, then post the signature here.',
      ),
    )
  }
  if (action !== 'record') {
    return errorResponse(fnError('bad-request', '`action` must be "record", or omitted.'))
  }

  const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
  if (!isValidSignature(signature)) {
    return errorResponse(fnError('bad-request', 'Post the `signature` the wallet returned.'))
  }

  // Optional, and optional on purpose: the row is complete and settleable without
  // it. A caller that omits it simply has no assertion on record to compare the
  // chain's answer against.
  const rawClaimed = body.claimedAmount ?? body.amount
  const claimed = rawClaimed === undefined || rawClaimed === null ? null : parseU64(rawClaimed)
  if (rawClaimed !== undefined && rawClaimed !== null && claimed === null) {
    return errorResponse(
      fnError('bad-request', '`claimedAmount` must be a u64 of raw units, given as a decimal string.'),
    )
  }

  // Before the blockhash read, so a refused post costs no RPC quota — an endpoint
  // anyone can call must not be a way to spend somebody else's rate limit.
  const refusal = await admit(config, signature)
  if (refusal) return errorResponse(refusal)

  const blockhash = await getLatestBlockhash(config.rpcUrl)
  if (isFnError(blockhash)) return errorResponse(blockhash)

  const row = await callRpc<PayoutRow>(config, 'record_payout_pending', {
    p_signature: signature,
    p_claimed_amount_unverified: claimed === null ? null : claimed.toString(),
    p_destination: config.devWallet,
    p_expires_at_block_height: blockhash.lastValidBlockHeight,
  })
  if (isFnError(row)) return errorResponse(row)

  return jsonResponse({
    ok: true,
    action: 'record',
    payout: row,
    // Said in the response as well as in the column name, so no caller can render
    // the claimed figure as a settled one by accident. Nothing has been verified
    // at this point except that a signature exists.
    amountVerified: false,
    expiresAtBlockHeight: blockhash.lastValidBlockHeight,
  })
}))
