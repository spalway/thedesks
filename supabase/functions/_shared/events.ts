// Deciding what a transaction was.
//
// Pure: a `TransferReading` in, a recognised event or a refusal out, no network
// and no database. That is not tidiness for its own sake — this function is the
// entire trust boundary of the backend, the place where "some tokens moved"
// becomes "this was a mint and here is what it cost", and it is worth being able
// to test every refusal without a validator.
//
// RECOGNITION IS EXACT, NOT PERMISSIVE, and that is the whole design. A mint is
// not "a transaction containing a transfer to the incinerator". It is a
// transaction whose *complete* set of $xNFT movements is exactly ONE leg —
// 10,000 to the incinerator, from a payer who is not the treasury — reconciled
// against the balance deltas. Everything else is refused, and one case shows why
// the exactness matters: a transaction that burns 10,000 and *also* moves $xNFT
// somewhere else is refused, because there is then no way to say which of the
// movements the row being written describes.
//
// ---------------------------------------------------------------------------
// THE MINT LOST ITS FEE LEG, WHICH MADE THIS FUNCTION'S JOB HARDER
// ---------------------------------------------------------------------------
// A mint used to be two transfers, and two transfers were self-identifying: the
// treasury leg said "this is one of ours" and the pair said which of the two
// two-legged shapes it was. Now a mint is one leg — and a treasury CLAIM is also
// one leg. So the leg count no longer distinguishes anything and the ownership
// of both ends has to.
//
// The order of the two one-leg branches below is therefore load-bearing rather
// than incidental:
//
//   claim first  — treasury -> dev wallet. Recognised so it can be EXCLUDED; its
//                  row belongs to request-payout and confirm-payout.
//   mint second  — anyone-but-the-treasury -> incinerator, at exactly the burn
//                  amount.
//
// The two cannot overlap, because the incinerator is not the dev wallet and the
// mint branch additionally refuses a treasury payer. But they are ordered anyway,
// so that a misconfiguration which somehow made them overlap resolves to "leave
// the payouts row alone" rather than to "write a mint for the operator".
//
// What was lost with the fee leg, stated plainly: there is no longer a second
// amount whose relationship to the first corroborates the transaction. A mint is
// now recognised by an exact amount and an exact destination alone. The balance
// deltas still have to agree, so this is not weaker than "one transfer of the
// right size" — it is exactly that, and a transaction that burns the right amount
// to the right address IS a mint under this protocol, because that is now the
// entire published price.
import { fnError, type FnError } from './http.ts'
import type { FunctionConfig } from './env.ts'
import { INCINERATOR_ADDRESS, RENT_FEE_BPS, feeOn, mintAmount } from './protocol.ts'
import { decimalsOf, netChangeFor, transfersOfMint, type TokenTransfer, type TransferReading } from './transfers.ts'

/**
 * A recognised movement set, with everything a writer needs and nothing it does
 * not.
 *
 * `eventIndex` is the flattened instruction position of the event's first leg —
 * a property of the transaction itself, so re-reading the same signature derives
 * the same value and collides with the same primary key. That is what makes
 * ingestion idempotent per *event* rather than merely per signature.
 */
export type ProtocolEvent =
  /**
   * One transfer, one destination, one amount. There is no `fee` member and
   * there must not be one — a mint pays nobody, and a zero-valued field here is
   * what a future contributor would fill in.
   */
  | { kind: 'mint'; eventIndex: number; buyer: string; burned: bigint }
  | { kind: 'rent'; eventIndex: number; renter: string; owner: string; gross: bigint; fee: bigint }
  /** A treasury claim. Real, verified, and deliberately not written by ingestion. */
  | { kind: 'payout'; eventIndex: number }

/** Only legs whose owners the reading actually resolved can be matched at all. */
function ownersResolved(legs: readonly TokenTransfer[]): boolean {
  return legs.every((leg) => leg.sourceOwner !== null && leg.destinationOwner !== null)
}

/**
 * Confirms the instruction legs and the balance deltas tell the same story.
 *
 * `netChangeFor` sums across every token account an owner holds of the mint, so
 * this catches the shape where two legs are ordered and a third movement quietly
 * undoes one of them inside a CPI. An owner the transaction touched no account of
 * comes back null, which fails — a payer whose balance did not change did not pay.
 */
function deltasAgree(
  reading: TransferReading,
  mint: string,
  expected: ReadonlyArray<{ owner: string; change: bigint }>,
): boolean {
  for (const { owner, change } of expected) {
    const actual = netChangeFor(reading, mint, owner)
    if (actual === null || actual !== change) return false
  }
  return true
}

/**
 * Classifies the transaction's $xNFT movements, or explains why it will not be
 * indexed.
 *
 * Returns an FnError rather than null for a refusal, because every refusal here
 * has a different sentence attached and the caller has nothing to add to it.
 */
export function recogniseEvent(config: FunctionConfig, reading: TransferReading): ProtocolEvent | FnError {
  const legs = transfersOfMint(reading, config.xnftMint)
  if (legs.length === 0) {
    return fnError('rejected', 'That transaction moved no $xNFT. Nothing was indexed.')
  }
  if (!ownersResolved(legs)) {
    // Without owners there is no way to say a transfer reached *the treasury*
    // rather than some other account, and inferring it from the token account
    // address would mean deriving associated-token addresses here on trust.
    return fnError('rejected', 'The transaction did not report the owners of the token accounts it moved.')
  }

  const decimals = decimalsOf(reading, config.xnftMint)
  if (decimals === null) {
    return fnError('rejected', 'The transaction reported no decimals for $xNFT.')
  }

  // ---- Claim: one leg, treasury to dev wallet -----------------------------
  //
  // Recognised so it can be *excluded*. A claim is an outflow, and its row is
  // owned end to end by request-payout and confirm-payout; writing one here would
  // either duplicate that row or race it into a wrong state. Falling through to
  // the "unrecognised" branch instead would return a 422 for a perfectly valid
  // transaction, which a client posting every signature it sends would surface as
  // an error worth showing someone.
  // `sweepsFees` first: with one wallet for both, this test degenerates into
  // "did the project wallet send $xNFT to itself", which is not a claim and
  // must not shadow the mint branch below it.
  if (
    config.sweepsFees &&
    legs.length === 1 &&
    legs[0].sourceOwner === config.treasury &&
    legs[0].destinationOwner === config.devWallet
  ) {
    return { kind: 'payout', eventIndex: legs[0].index }
  }

  // ---- Mint: one leg, to the incinerator ----------------------------------
  //
  // Checked AFTER the claim branch above, for the reason given in the header:
  // both shapes are now a single transfer, so the ordering is what guarantees a
  // treasury outflow can never be read as a burn.
  //
  // Equality on the amount, not a floor and not a minimum. This is the protocol's
  // published price — 10,000 $xNFT, all of it destroyed — and a transaction that
  // sent a different amount to the incinerator is somebody burning tokens, which
  // is their business and is not a mint.
  if (legs.length === 1 && legs[0].destinationOwner === INCINERATOR_ADDRESS) {
    const leg = legs[0]
    // Named `burner` rather than `payer` so it does not shadow the two-leg
    // branch's binding below — two variables with one name in one function is
    // exactly how a rental's payer ends up recorded as a mint's buyer.
    const burner = leg.sourceOwner
    if (burner === null) {
      return fnError('rejected', 'The burn did not report the owner of the account it came from.')
    }
    // Only when the two are distinct. The rule exists so an operator sweeping
    // fees out of the treasury can never be read as somebody buying an xployee;
    // where one wallet does both jobs there is no sweep to confuse it with, and
    // enforcing it anyway would mean the project wallet could never mint.
    if (config.sweepsFees && burner === config.treasury) {
      return fnError('rejected', 'The treasury does not mint. Nothing was indexed.')
    }

    const expected = mintAmount(decimals)
    if (expected === null) {
      return fnError('rejected', '$xNFT reports an implausible decimal count, so no mint amount can be checked.')
    }
    if (leg.amount !== expected) {
      return fnError(
        'rejected',
        `A mint burns exactly ${expected.toString()} raw units. This transaction burned ${leg.amount.toString()}. Nothing was written.`,
      )
    }
    // The instructions say what was ordered; the deltas say what happened. Both
    // sides are checked because a burn ordered and then undone inside a CPI would
    // pass the first test on its own.
    if (
      !deltasAgree(reading, config.xnftMint, [
        { owner: burner, change: -expected },
        { owner: INCINERATOR_ADDRESS, change: expected },
      ])
    ) {
      return fnError('rejected', 'The burn instruction and the balance changes disagree. Nothing was written.')
    }
    return { kind: 'mint', eventIndex: leg.index, buyer: burner, burned: expected }
  }

  if (legs.length !== 2) {
    return fnError(
      'rejected',
      `That transaction moved $xNFT in ${legs.length} transfers. A mint is exactly one to the incinerator, a claim is exactly one from the treasury, and a rental is exactly two; nothing was written.`,
    )
  }

  const [first, second] = legs
  const payer = first.sourceOwner
  if (payer === null || second.sourceOwner !== payer) {
    return fnError('rejected', 'The two $xNFT transfers came from different payers, so they are not one event.')
  }
  // Same reasoning as the mint branch: only meaningful where the treasury is a
  // wallet distinct from the one a person actually spends from.
  if (config.sweepsFees && payer === config.treasury) {
    return fnError('rejected', 'The treasury does not mint or rent. Nothing was indexed.')
  }

  const toTreasury = legs.filter((leg) => leg.destinationOwner === config.treasury)
  if (toTreasury.length !== 1) {
    return fnError('rejected', 'The only two-legged shape this index recognises is a rental, which has exactly one treasury leg.')
  }
  const feeLeg = toTreasury[0]
  const otherLeg = feeLeg === first ? second : first
  const eventIndex = Math.min(feeLeg.index, otherLeg.index)

  // A two-leg transaction reaching the incinerator is NOT a mint. It used to be
  // the only mint shape; it is now a burn with an unexplained payment attached,
  // and the honest answer is that this index does not know what it is. Refusing
  // it by name rather than letting it fall through to the rental branch means the
  // sentence a caller gets names the actual problem — and it means a client that
  // is still building the old two-leg transaction fails loudly instead of being
  // silently reinterpreted as a rental of the incinerator.
  if (otherLeg.destinationOwner === INCINERATOR_ADDRESS || feeLeg === otherLeg) {
    return fnError(
      'rejected',
      'A mint is one transfer to the incinerator and pays no fee. This transaction burned $xNFT and also paid the treasury, which is not a shape this index recognises. Nothing was written.',
    )
  }

  // ---- Rent: the owner's take + the 10% ------------------------------------
  //
  // A rental has no fixed price, so the recogniser is the relationship between
  // the legs rather than their values: the treasury leg must be exactly the fee
  // `src/lib/fees.ts` computes on the owner's leg. That is a tighter test than it
  // sounds — the fee is floored once on the contract total, so only the amounts a
  // real rent quote produces satisfy it.
  const owner = otherLeg.destinationOwner
  if (owner === null || owner === config.treasury || owner === INCINERATOR_ADDRESS || owner === payer) {
    return fnError('rejected', 'The second $xNFT transfer went somewhere no recognised event sends value.')
  }
  if (otherLeg.amount <= 0n) {
    return fnError('rejected', 'A rental that pays the owner nothing is not a rental.')
  }
  const expectedFee = feeOn(otherLeg.amount, RENT_FEE_BPS)
  if (expectedFee === null || feeLeg.amount !== expectedFee) {
    return fnError(
      'rejected',
      `A rental fee is 10% of the owner's take. Expected ${expectedFee?.toString() ?? 'nothing'} raw units, ` +
        `saw ${feeLeg.amount.toString()}. Nothing was written.`,
    )
  }
  if (
    !deltasAgree(reading, config.xnftMint, [
      { owner: payer, change: -(otherLeg.amount + expectedFee) },
      { owner, change: otherLeg.amount },
      { owner: config.treasury, change: expectedFee },
    ])
  ) {
    return fnError('rejected', 'The rental instructions and the balance changes disagree. Nothing was written.')
  }

  return { kind: 'rent', eventIndex, renter: payer, owner, gross: otherLeg.amount, fee: expectedFee }
}
