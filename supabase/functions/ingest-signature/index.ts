// ingest-signature — the only write path for chain-derived data.
//
// The entire security model of this backend is still one sentence, and the
// program's removal did not weaken it: this function does not believe anything
// the caller tells it except which signature to go look at. The request body
// carries a signature and nothing else. Every number that reaches the database is
// read out of a transaction this function fetched from RPC itself.
//
// WHAT CHANGED. It used to verify "did xnft_market run, and what did it say it
// did?" — a program id plus a Borsh event payload. There is no program, so it
// now verifies something narrower and stronger: "did exactly these tokens move
// between exactly these accounts?" A program's event is a claim the program makes
// about itself; a token balance delta is the ledger's own account of what
// changed. Nothing but the real transfer can produce one.
//
// RECOGNITION IS EXACT, NOT PERMISSIVE, and it lives in `_shared/events.ts` as a
// pure function so every refusal can be tested without a validator. Read that
// file for what a mint has to look like; the short version is that it is not "a
// transaction containing a transfer to the incinerator", it is a transaction
// whose complete set of $xNFT movements is exactly the two expected legs.
//
// The checks, in the order they run and why each one exists:
//
//   1. The signature parses as 64 base58 bytes. Cheap, and a malformed post never
//      costs an RPC call.
//   2. Already indexed? Return immediately. Ingestion is idempotent on the
//      primary key regardless; short-circuiting makes a replay free rather than
//      merely harmless.
//   3. The transaction exists. A signature RPC has not caught up to is a 202 and
//      a retry, not a failure — the normal state for the first second after send.
//   4. `meta.err` is null. A transaction that landed and failed moved nothing.
//   5. Every token instruction in it was readable. An instruction addressed to
//      the token program that the node did not parse is a hole in the reading,
//      and "cannot see" is never reported as "did not happen".
//   6. The movement set matches one recognised shape exactly, amounts included.
//   7. Net balance deltas agree with the instruction legs. Belt and braces: the
//      instructions say what was ordered, the deltas say what happened.
//
// Nothing throws. Every outcome is a JSON body with a code the client can branch
// on, and a failure never leaves a partial write behind because each event is
// applied by a single SECURITY DEFINER function in one database transaction.
import { isValidSignature } from '../_shared/base58.ts'
import { callRpc } from '../_shared/db.ts'
import { loadConfig, type FunctionConfig } from '../_shared/env.ts'
import { errorResponse, fnError, isFnError, jsonResponse, readJsonBody, serveSafely, type FnError } from '../_shared/http.ts'
import { recogniseEvent, type ProtocolEvent } from '../_shared/events.ts'
import { isStorableAmount } from '../_shared/protocol.ts'
import { readTransfers, toIsoTime } from '../_shared/transfers.ts'

/**
 * What a writer told us it did.
 *
 * `record_mint` returns jsonb rather than the bare 'inserted' / 'duplicate'
 * string the other writers use, because a mint now has a second axis: it was
 * recorded either way, and it either received a serial or did not. Collapsing
 * that into one word would lose exactly the case a buyer needs to be told about
 * — their tokens are burned and the assignment is held for an operator.
 */
interface WriteResult {
  outcome: 'inserted' | 'duplicate' | 'ignored'
  assignmentStatus?: 'assigned' | 'held'
  heldReason?: string
  xployeeId?: number | null
  serialLabel?: string | null
  tier?: string | null
}

interface MintWriteRow {
  ok?: boolean
  outcome?: unknown
  assignment_status?: unknown
  held_reason?: unknown
  xployee_id?: unknown
  serial_label?: unknown
  tier?: unknown
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

async function applyEvent(
  config: FunctionConfig,
  event: ProtocolEvent,
  signature: string,
  slot: number,
  blockTime: string | null,
): Promise<WriteResult | FnError> {
  // Every amount below came out of `recogniseEvent`, derived from the chain.
  // The storability check is about the column, not about trust: a u64 above
  // Postgres's signed bigint would still fit the `u64_text` domain but would
  // ambush any future ::numeric aggregation, so it is refused at the edge.
  switch (event.kind) {
    case 'mint': {
      if (!isStorableAmount(event.burned)) {
        return fnError('rejected', 'That mint burned an amount too large to index.')
      }
      // No `p_fee`. The mint fee is gone and the function signature no longer has
      // a place to put one — see 20260806090000_mint_fee_retired.sql, which drops
      // the seven-argument version so a caller still passing a fee gets "function
      // does not exist" rather than writing a number nowhere.
      const row = await callRpc<MintWriteRow>(config, 'record_mint', {
        p_signature: signature,
        p_event_index: event.eventIndex,
        p_slot: slot,
        p_block_time: blockTime,
        p_buyer: event.buyer,
        p_burned: event.burned.toString(),
      })
      if (isFnError(row)) return row

      const outcome = row?.outcome === 'duplicate' ? 'duplicate' : 'inserted'
      const assignment = row?.assignment_status === 'held' ? 'held' : 'assigned'
      return {
        outcome,
        assignmentStatus: assignment,
        heldReason: str(row?.held_reason),
        xployeeId: typeof row?.xployee_id === 'number' ? row.xployee_id : null,
        serialLabel: str(row?.serial_label) ?? null,
        tier: str(row?.tier) ?? null,
      }
    }
    case 'rent': {
      if (!isStorableAmount(event.gross) || !isStorableAmount(event.fee)) {
        return fnError('rejected', 'That rental moved an amount too large to index.')
      }
      const result = await callRpc<string>(config, 'record_rent', {
        p_signature: signature,
        p_event_index: event.eventIndex,
        p_slot: slot,
        p_block_time: blockTime,
        p_renter: event.renter,
        p_owner: event.owner,
        p_gross: event.gross.toString(),
        p_fee: event.fee.toString(),
      })
      if (isFnError(result)) return result
      return { outcome: result === 'inserted' ? 'inserted' : 'duplicate' }
    }
    case 'payout':
      return { outcome: 'ignored' }
  }
}

Deno.serve(serveSafely(async (request: Request): Promise<Response> => {
  const body = await readJsonBody(request)
  if (isFnError(body)) return errorResponse(body)

  const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
  if (!signature) {
    return errorResponse(fnError('bad-request', 'Post a `signature`.'))
  }
  if (!isValidSignature(signature)) {
    return errorResponse(fnError('bad-request', 'That is not a Solana transaction signature.'))
  }

  const config = loadConfig()
  if (isFnError(config)) return errorResponse(config)

  const alreadyIndexed = await callRpc<boolean>(config, 'is_signature_indexed', { p_signature: signature })
  if (isFnError(alreadyIndexed)) return errorResponse(alreadyIndexed)
  if (alreadyIndexed === true) {
    return jsonResponse({ ok: true, signature, status: 'duplicate', events: [] })
  }

  const reading = await readTransfers(config.rpcUrl, signature)
  if (isFnError(reading)) return errorResponse(reading)

  const event = recogniseEvent(config, reading)
  if (isFnError(event)) return errorResponse(event)

  const blockTime = toIsoTime(reading.blockTime)
  const result = await applyEvent(config, event, signature, reading.slot, blockTime)
  if (isFnError(result)) return errorResponse(result)

  return jsonResponse({
    ok: true,
    signature,
    slot: reading.slot,
    blockTime,
    status: result.outcome === 'inserted' ? 'indexed' : 'duplicate',
    // The array shape is kept even though a transaction now resolves to exactly
    // one event: recognition is all-or-nothing per transaction, so a second entry
    // could never appear, and callers that already iterate this do not need to
    // change to find that out.
    events: [{ kind: event.kind, outcome: result.outcome }],
    // The mint's second axis, surfaced rather than folded into `status`.
    //
    // 'held' means the burn is REAL, verified, and recorded, and no serial was
    // assigned because the rate limit would not have granted one. A client must
    // render that as "your tokens are burned and this is with an operator", never
    // as a failure — the money is gone and telling someone their mint failed is
    // how they burn a second 10,000 trying again.
    ...(event.kind === 'mint'
      ? {
          assignment: {
            status: result.assignmentStatus ?? 'assigned',
            xployeeId: result.xployeeId ?? null,
            serial: result.serialLabel ?? null,
            tier: result.tier ?? null,
            ...(result.heldReason ? { heldReason: result.heldReason } : {}),
          },
        }
      : {}),
  })
}))
