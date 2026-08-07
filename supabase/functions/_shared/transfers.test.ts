// Tests for the one question that decides whether a payout may be called failed.
//
// `confirm-payout` is allowed exactly one definite negative drawn from not seeing
// something, and everything else has to stay pending — because a claim that
// actually landed, shown as failed, is answered by claiming again, and the second
// claim is a second withdrawal of real money out of a treasury whose only lock is
// a private key.
//
// The hole this file closes was in the OTHER negative, the one that looks like an
// observation rather than an absence: "the transaction confirmed and contains no
// treasury→dev-wallet transfer". That conclusion was drawn from an empty filter
// over `sourceOwner` / `destinationOwner`, and those are null whenever the RPC
// did not report a token account's owner — optional metadata that nodes are free
// to omit. A null loses every comparison, so a perfectly ordinary claim read from
// a node that does not resolve owners produced the identical empty array as a
// transaction that moved nothing, and the row was settled FAILED on the strength
// of not having looked.
//
// `ownersFullyAttributed` is the guard. These cases are hand-built readings, the
// same style as events.test.ts, because the distinction is a property of the
// reading and needs no validator to exercise.
import { describe, expect, it } from 'vitest'

import {
  netChangeFor,
  ownersFullyAttributed,
  transfersOfMint,
  type TokenAccountDelta,
  type TokenTransfer,
  type TransferReading,
} from './transfers.ts'

const MINT = 'xNFTmint1111111111111111111111111111111111'
const OTHER_MINT = '0THERmint111111111111111111111111111111111'
const TREASURY = 'TREASURYwa11et11111111111111111111111111111'
const DEV = 'DEVwa11et111111111111111111111111111111111'
const DECIMALS = 9

function transfer(overrides: Partial<TokenTransfer> = {}): TokenTransfer {
  return {
    index: 0,
    mint: MINT,
    source: `ata-${TREASURY}`,
    destination: `ata-${DEV}`,
    sourceOwner: TREASURY,
    destinationOwner: DEV,
    authority: TREASURY,
    amount: 250n,
    ...overrides,
  }
}

function delta(overrides: Partial<TokenAccountDelta> = {}): TokenAccountDelta {
  return {
    account: `ata-${TREASURY}`,
    mint: MINT,
    owner: TREASURY,
    pre: 250n,
    post: 0n,
    change: -250n,
    decimals: DECIMALS,
    ...overrides,
  }
}

/** A clean claim: 250 raw units out of the treasury and into the dev wallet. */
function claim(): TransferReading {
  return {
    signature: 'sig',
    slot: 1,
    blockTime: 0,
    transfers: [transfer()],
    deltas: [
      delta(),
      delta({ account: `ata-${DEV}`, owner: DEV, pre: 0n, post: 250n, change: 250n }),
    ],
  }
}

describe('owner attribution decides whether an absence is a fact', () => {
  it('is complete on a reading where every account reported its owner', () => {
    expect(ownersFullyAttributed(claim(), MINT)).toBe(true)
  })

  it('is incomplete when a transfer leg has an unresolved source owner', () => {
    const reading = claim()
    reading.transfers = [transfer({ sourceOwner: null })]
    expect(ownersFullyAttributed(reading, MINT)).toBe(false)
  })

  it('is incomplete when a transfer leg has an unresolved destination owner', () => {
    const reading = claim()
    reading.transfers = [transfer({ destinationOwner: null })]
    expect(ownersFullyAttributed(reading, MINT)).toBe(false)
  })

  it('is incomplete when a balance delta has no owner', () => {
    // The deltas matter on their own: the settled amount is read from them, so an
    // unattributed delta is value moving into an account this reading cannot name.
    const reading = claim()
    reading.deltas = [delta({ owner: null })]
    expect(ownersFullyAttributed(reading, MINT)).toBe(false)
  })

  it('ignores unattributed movements of other mints', () => {
    // Someone else's unparsed token movement in the same transaction says nothing
    // about whether $xNFT left the treasury, and treating it as doubt would leave
    // every claim bundled with an unrelated swap pending forever.
    const reading = claim()
    reading.transfers.push(transfer({ mint: OTHER_MINT, sourceOwner: null, destinationOwner: null }))
    reading.deltas.push(delta({ mint: OTHER_MINT, owner: null }))
    expect(ownersFullyAttributed(reading, MINT)).toBe(true)
  })

  it('is vacuously complete when the transaction did not touch the mint at all', () => {
    // Nothing of this mint moved and nothing was unreadable. This is the shape
    // that genuinely is 'absent' — a signature that was never a claim — and it has
    // to stay distinguishable from the ones above.
    const reading: TransferReading = { signature: 'sig', slot: 1, blockTime: 0, transfers: [], deltas: [] }
    expect(ownersFullyAttributed(reading, MINT)).toBe(true)
  })
})

describe('the readings confirm-payout builds its verdict from', () => {
  it('finds the claim leg when owners are reported', () => {
    const legs = transfersOfMint(claim(), MINT).filter(
      (leg) => leg.sourceOwner === TREASURY && leg.destinationOwner === DEV,
    )
    expect(legs).toHaveLength(1)
  })

  it('finds nothing when owners are not reported — which is why the guard exists', () => {
    // The exact defect, stated as a test: this filter is empty, and it is empty
    // for a transaction that moved 250 raw units out of the treasury. Reading that
    // emptiness as "not a claim" is what settled a landed payout as failed.
    const reading = claim()
    reading.transfers = [transfer({ sourceOwner: null, destinationOwner: null })]

    const legs = transfersOfMint(reading, MINT).filter(
      (leg) => leg.sourceOwner === TREASURY && leg.destinationOwner === DEV,
    )
    expect(legs).toHaveLength(0)
    expect(ownersFullyAttributed(reading, MINT)).toBe(false)
  })

  it('reads the settled amount from the deltas, not from the instruction legs', () => {
    expect(netChangeFor(claim(), MINT, DEV)).toBe(250n)
    expect(netChangeFor(claim(), MINT, TREASURY)).toBe(-250n)
  })

  it('reports null rather than zero for a wallet the transaction never touched', () => {
    // Different from a change of zero, and the caller treats it as such: it is the
    // difference between "this wallet gained nothing" and "nothing here mentions
    // this wallet".
    expect(netChangeFor(claim(), OTHER_MINT, DEV)).toBeNull()
  })
})
