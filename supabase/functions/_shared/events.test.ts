// Tests for the ingest trust boundary.
//
// These run under vitest with the rest of the repo, not under Deno, which is why
// they only touch the pure modules: `events.ts`, `transfers.ts` and
// `protocol.ts`. Nothing here opens a socket or needs a validator — the whole
// point of pulling `recogniseEvent` out of the handler was that the decision
// "was this a mint?" can be exercised on hand-built readings.
//
// What is worth asserting, and what these cases are actually for:
//
//   * The exact set. A mint is ONE transfer of 10,000 to the incinerator and
//     nothing else. Most of the cases below are near-misses — one raw unit short,
//     right amount extra leg, right amount wrong destination — because a
//     permissive recogniser fails on near-misses, not on obviously-unrelated
//     transactions.
//   * The deltas. Instructions say what was ordered; balances say what happened.
//     A reading where they disagree must be refused even though the instruction
//     list on its own looks perfect.
//   * The destination. A burn addressed anywhere but the incinerator is not a
//     mint at any amount.
//   * THE ONE-LEG COLLISION. A mint and a treasury claim are now both a single
//     transfer, so the leg count distinguishes nothing and the ownership of both
//     ends has to. Several cases below exist only to prove the two branches
//     cannot be made to overlap.
import { describe, expect, it } from 'vitest'

import { recogniseEvent } from './events.ts'
import { INCINERATOR_ADDRESS, MINT_BURN, mintAmount } from './protocol.ts'
import { netChangeFor, transfersOfMint, type TokenTransfer, type TransferReading } from './transfers.ts'
import type { FunctionConfig } from './env.ts'
import { isFnError } from './http.ts'

// Real-shaped base58, but none of it has to be a real account: nothing in the
// pure path parses these, it only compares them.
const MINT = 'xNFTmint1111111111111111111111111111111111'
const TREASURY = 'TREASURYwa11et11111111111111111111111111111'
const DEV = 'DEVwa11et111111111111111111111111111111111'
const BUYER = 'BUYERwa11et1111111111111111111111111111111'
const OWNER = '0WNERwa11et1111111111111111111111111111111'
const OTHER = '0THERwa11et1111111111111111111111111111111'
const DECIMALS = 9

const config: FunctionConfig = {
  rpcUrl: 'https://example.invalid',
  xnftMint: MINT,
  treasury: TREASURY,
  devWallet: DEV,
  sweepsFees: true,
  supabaseUrl: 'https://example.invalid',
  serviceRoleKey: 'unused',
}

const BURN = mintAmount(DECIMALS)!

interface Leg {
  from: string
  to: string
  amount: bigint
  mint?: string
}

/**
 * Builds a reading whose deltas are derived from the legs, so the default case is
 * always self-consistent and a test that wants disagreement has to introduce it
 * deliberately via `extraDeltas`.
 */
function reading(legs: Leg[], extraDeltas: { owner: string; change: bigint; mint?: string }[] = []): TransferReading {
  const transfers: TokenTransfer[] = legs.map((leg, index) => ({
    index,
    mint: leg.mint ?? MINT,
    source: `ata-${leg.from}`,
    destination: `ata-${leg.to}`,
    sourceOwner: leg.from,
    destinationOwner: leg.to,
    authority: leg.from,
    amount: leg.amount,
  }))

  const net = new Map<string, bigint>()
  const bump = (owner: string, mint: string, by: bigint) => {
    const key = `${mint}|${owner}`
    net.set(key, (net.get(key) ?? 0n) + by)
  }
  for (const leg of legs) {
    const mint = leg.mint ?? MINT
    bump(leg.from, mint, -leg.amount)
    bump(leg.to, mint, leg.amount)
  }
  for (const extra of extraDeltas) bump(extra.owner, extra.mint ?? MINT, extra.change)

  const deltas = [...net.entries()].map(([key, change]) => {
    const [mint, owner] = key.split('|')
    return { account: `ata-${owner}`, mint, owner, pre: 0n, post: change, change, decimals: DECIMALS }
  })

  return { signature: 'sig', slot: 1, blockTime: 0, transfers, deltas }
}

const mintReading = () => reading([{ from: BUYER, to: INCINERATOR_ADDRESS, amount: BURN }])

describe('the economic constants this backend recognises against', () => {
  it('is 10,000 burned at 9 decimals, and nothing else', () => {
    expect(BURN).toBe(10_000n * 10n ** 9n)
    expect(MINT_BURN).toBe(10_000n)
  })

  it('returns a bare amount, so there is no field a fee could reappear in', () => {
    // The shape is the guarantee. `mintLegs` used to return { burn, fee, total },
    // and a struct with a `fee` member is a struct somebody fills in — the same
    // reasoning src/lib/fees.ts gives for deleting mintQuote().
    expect(typeof mintAmount(9)).toBe('bigint')
  })

  it('scales with the mint and refuses an implausible exponent', () => {
    expect(mintAmount(0)).toBe(10_000n)
    expect(mintAmount(6)).toBe(10_000n * 10n ** 6n)
    expect(mintAmount(19)).toBeNull()
    expect(mintAmount(-1)).toBeNull()
    expect(mintAmount(1.5)).toBeNull()
  })
})

describe('recognising a mint', () => {
  it('accepts exactly one transfer of the burn amount to the incinerator', () => {
    const event = recogniseEvent(config, mintReading())
    expect(isFnError(event)).toBe(false)
    expect(event).toMatchObject({ kind: 'mint', buyer: BUYER, burned: BURN })
  })

  it('carries no fee field at all', () => {
    // Not "carries a fee of zero". A recognised mint has no such property, so a
    // consumer cannot read one and a writer cannot forward one.
    const event = recogniseEvent(config, mintReading())
    expect(Object.prototype.hasOwnProperty.call(event, 'fee')).toBe(false)
  })

  it('takes the event index from the transaction, so a replay derives the same key', () => {
    const first = recogniseEvent(config, mintReading())
    const second = recogniseEvent(config, mintReading())
    expect(first).toEqual(second)
    expect((first as { eventIndex: number }).eventIndex).toBe(0)
  })

  it('refuses a burn one raw unit short', () => {
    const event = recogniseEvent(config, reading([{ from: BUYER, to: INCINERATOR_ADDRESS, amount: BURN - 1n }]))
    expect(isFnError(event)).toBe(true)
  })

  it('refuses a burn one raw unit over', () => {
    const event = recogniseEvent(config, reading([{ from: BUYER, to: INCINERATOR_ADDRESS, amount: BURN + 1n }]))
    expect(isFnError(event)).toBe(true)
  })

  it('refuses the right amount sent anywhere but the incinerator', () => {
    const event = recogniseEvent(config, reading([{ from: BUYER, to: OTHER, amount: BURN }]))
    expect(isFnError(event)).toBe(true)
  })

  it('refuses a correct burn that also moves $xNFT somewhere else', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: INCINERATOR_ADDRESS, amount: BURN },
        { from: BUYER, to: OTHER, amount: 1n },
      ]),
    )
    expect(isFnError(event)).toBe(true)
  })

  it('refuses the OLD two-leg mint, so a stale client fails loudly', () => {
    // This is exactly the transaction src/lib/spl.ts used to build: the burn plus
    // a 5% treasury leg. It must not be quietly reinterpreted — as a mint at a
    // premium, or as a rental of the incinerator.
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: INCINERATOR_ADDRESS, amount: BURN },
        { from: BUYER, to: TREASURY, amount: BURN / 20n },
      ]),
    )
    expect(isFnError(event)).toBe(true)
    expect((event as { message: string }).message).toContain('pays no fee')
  })

  it('ignores movements of a different mint entirely', () => {
    const withNoise = reading([
      { from: BUYER, to: INCINERATOR_ADDRESS, amount: BURN },
      { from: BUYER, to: OTHER, amount: 42n, mint: 'SomeOtherM1nt111111111111111111111111111111' },
    ])
    expect(recogniseEvent(config, withNoise)).toMatchObject({ kind: 'mint' })
  })

  it('refuses when the balance deltas contradict the instruction', () => {
    // The instruction list is a perfect mint. The incinerator's net change is
    // not: something inside the same transaction handed the burn back.
    const contradicted = mintReading()
    const tampered: TransferReading = {
      ...contradicted,
      deltas: contradicted.deltas.map((d) =>
        d.owner === INCINERATOR_ADDRESS ? { ...d, change: 0n, post: 0n } : d,
      ),
    }
    expect(isFnError(recogniseEvent(config, tampered))).toBe(true)
  })

  it('refuses when a leg has no resolved owner', () => {
    const anonymous = mintReading()
    anonymous.transfers[0] = { ...anonymous.transfers[0], destinationOwner: null }
    expect(isFnError(recogniseEvent(config, anonymous))).toBe(true)
  })

  it('refuses a transaction that moved no $xNFT at all', () => {
    const event = recogniseEvent(
      config,
      reading([{ from: BUYER, to: OTHER, amount: 5n, mint: 'SomeOtherM1nt111111111111111111111111111111' }]),
    )
    expect(isFnError(event)).toBe(true)
  })
})

describe('a mint and a claim are both one leg, and cannot be confused', () => {
  // The collision the fee removal created. Before it, a mint was two transfers
  // and a claim was one, so the count separated them. Now both are one and only
  // the ownership of the two ends does.

  it('refuses the treasury burning, so an operator outflow is never a mint', () => {
    const event = recogniseEvent(config, reading([{ from: TREASURY, to: INCINERATOR_ADDRESS, amount: BURN }]))
    expect(isFnError(event)).toBe(true)
    expect((event as { message: string }).message).toContain('treasury does not mint')
  })

  it('still classifies treasury -> dev wallet as a payout at the exact burn amount', () => {
    // The amount is the one a mint uses. If the mint branch were reached first,
    // or if it did not check the payer, this would be written as somebody minting
    // with the operator's own tokens.
    const event = recogniseEvent(config, reading([{ from: TREASURY, to: DEV, amount: BURN }]))
    expect(event).toMatchObject({ kind: 'payout' })
  })

  it('does not treat a burn by an ordinary wallet as a claim', () => {
    const event = recogniseEvent(config, mintReading())
    expect(event).toMatchObject({ kind: 'mint' })
  })
})

describe('recognising a rental', () => {
  const gross = 1_234_000_000_000n
  const fee = gross / 10n

  it('accepts the owner leg plus exactly 10%', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: OWNER, amount: gross },
        { from: BUYER, to: TREASURY, amount: fee },
      ]),
    )
    expect(event).toMatchObject({ kind: 'rent', renter: BUYER, owner: OWNER, gross, fee })
  })

  it('is order-insensitive — the treasury leg may come first', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: TREASURY, amount: fee },
        { from: BUYER, to: OWNER, amount: gross },
      ]),
    )
    expect(event).toMatchObject({ kind: 'rent', gross, fee })
  })

  it('floors the fee the same way src/lib/fees.ts does', () => {
    // 19 raw units at 10% floors to 1, not 2. The recogniser must accept exactly
    // what the quote the renter signed produced.
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: OWNER, amount: 19n },
        { from: BUYER, to: TREASURY, amount: 1n },
      ]),
    )
    expect(event).toMatchObject({ kind: 'rent', gross: 19n, fee: 1n })

    const rounded = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: OWNER, amount: 19n },
        { from: BUYER, to: TREASURY, amount: 2n },
      ]),
    )
    expect(isFnError(rounded)).toBe(true)
  })

  it('refuses a short treasury cut', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: OWNER, amount: gross },
        { from: BUYER, to: TREASURY, amount: fee - 1n },
      ]),
    )
    expect(isFnError(event)).toBe(true)
  })

  it('refuses a self-rental', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: BUYER, amount: gross },
        { from: BUYER, to: TREASURY, amount: fee },
      ]),
    )
    expect(isFnError(event)).toBe(true)
  })

  it('refuses a rental that pays the owner nothing', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: BUYER, to: OWNER, amount: 0n },
        { from: BUYER, to: TREASURY, amount: 0n },
      ]),
    )
    expect(isFnError(event)).toBe(true)
  })
})

describe('recognising a treasury claim', () => {
  it('classifies it as a payout so ingestion leaves the payouts row alone', () => {
    const event = recogniseEvent(config, reading([{ from: TREASURY, to: DEV, amount: 7n }]))
    expect(event).toMatchObject({ kind: 'payout' })
  })

  it('refuses a treasury outflow to anywhere but the dev wallet', () => {
    const event = recogniseEvent(config, reading([{ from: TREASURY, to: OTHER, amount: 7n }]))
    expect(isFnError(event)).toBe(true)
  })

  it('refuses the treasury paying two legs, so a claim cannot masquerade as a rental', () => {
    const event = recogniseEvent(
      config,
      reading([
        { from: TREASURY, to: OWNER, amount: 100n },
        { from: TREASURY, to: TREASURY, amount: 10n },
      ]),
    )
    expect(isFnError(event)).toBe(true)
  })
})

describe('reading helpers', () => {
  it('sums an owner’s change across every account they hold of the mint', () => {
    const r = mintReading()
    const split: TransferReading = {
      ...r,
      deltas: [
        ...r.deltas,
        { account: 'second-ata', mint: MINT, owner: BUYER, pre: 0n, post: 0n, change: -1n, decimals: DECIMALS },
      ],
    }
    expect(netChangeFor(split, MINT, BUYER)).toBe(-BURN - 1n)
  })

  it('distinguishes “no account of this owner” from “changed by zero”', () => {
    const r = mintReading()
    expect(netChangeFor(r, MINT, OTHER)).toBeNull()
    expect(netChangeFor(r, MINT, BUYER)).toBe(-BURN)
  })

  it('filters transfers by mint', () => {
    const r = reading([
      { from: BUYER, to: TREASURY, amount: 1n },
      { from: BUYER, to: OTHER, amount: 2n, mint: 'SomeOtherM1nt111111111111111111111111111111' },
    ])
    expect(transfersOfMint(r, MINT)).toHaveLength(1)
  })
})

describe('when one wallet is both the treasury and the dev wallet', () => {
  // A supported deployment, not a mistake: one wallet collects fees and the same
  // wallet pays people, so there is no sweep because the money never has
  // anywhere to go. loadConfig used to refuse it outright.
  const single: FunctionConfig = { ...config, treasury: DEV, sweepsFees: false }

  it('lets the project wallet mint', () => {
    // The regression this guards. `burner === config.treasury` rejects a mint as
    // "the treasury does not mint" — a rule that exists so an operator sweeping
    // fees is never read as somebody buying. With one wallet doing both jobs
    // there is no sweep to confuse it with, and enforcing it anyway means the
    // project wallet can never mint its own xployee.
    const event = recogniseEvent(single, reading([{ from: DEV, to: INCINERATOR_ADDRESS, amount: BURN }]))
    expect(event).toMatchObject({ kind: 'mint' })
  })

  it('still refuses a treasury mint when the two ARE distinct', () => {
    const event = recogniseEvent(config, reading([{ from: TREASURY, to: INCINERATOR_ADDRESS, amount: BURN }]))
    expect((event as { message: string }).message).toContain('treasury does not mint')
  })

  it('does not read a self-transfer as a claim', () => {
    // With one wallet the claim test degenerates to "did the project wallet send
    // $xNFT to itself". That is not a payout, and letting it match would also
    // shadow the mint branch that sits below it.
    const event = recogniseEvent(single, reading([{ from: DEV, to: DEV, amount: BURN }]))
    expect((event as { kind?: string }).kind).not.toBe('payout')
  })

  it('still recognises a real claim when the two ARE distinct', () => {
    const event = recogniseEvent(config, reading([{ from: TREASURY, to: DEV, amount: BURN }]))
    expect(event).toMatchObject({ kind: 'payout' })
  })
})
