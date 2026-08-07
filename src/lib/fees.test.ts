// Money arithmetic, the mint's economics, and the audit that every figure this
// app puts on screen is a real number.
//
// Three things are being defended here and they fail in different ways:
//
//   1. The arithmetic. Fees floor, totals are exactly gross + fee, and raw units
//      convert in decimal digits rather than binary ones. A regression is a
//      wrong charge.
//   2. The pricing. Minting is meant to be an EV-neutral tier lottery, and the
//      economics block below recomputes the whole derivation from SKILLS and
//      TIERS so a tune that reopens an arbitrage fails loudly.
//   3. The finiteness. Every number rendered anywhere in this app comes out of
//      one of these modules, and a NaN, an Infinity or a -0 in a money column
//      reads as a broken product even when the underlying maths is fine. The
//      last two blocks sweep the three states that historically produce them: a
//      wallet holding nothing, a worker at t = 0, and a price feed that answers
//      with nothing at all.
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  BPS_DENOM,
  MAX_FEE_BPS,
  MINT_BURN,
  SIM_RENT_FEE_BPS,
  SIM_SALE_FEE_BPS,
  XNFT_DECIMALS,
  bpsFraction,
  feeOn,
  fromRawUnits,
  mintAmount,
  quoteFor,
  rentQuote,
  saleQuote,
  toRawUnits,
  totalWithFee,
} from './fees'
import {
  XNFT_USD,
  EXPECTED_MINT_VALUE_USD,
  contractMath,
  fairValueXnft,
  floorPrice,
  saleListings,
  type ContractListing,
} from './market'
import { collection } from './collection'
import {
  EPOCHS_PER_YEAR,
  EPOCH_MS,
  accruedBySkill,
  accruedTotal,
  bookValue,
  tenureYears,
  trailingApy,
  yieldPerEpoch,
} from './accrual'
import { TIERS, tierForId } from './tiers'
import { SKILLS, blendedApy } from './skills'
import { buildXployee, principalFor, MAX_SUPPLY } from './xployee'
import { SOL_USD, earningsFor, canRequest, usdToSol } from './earnings'
import { networkStats, networkWallets, nextRank, xBossFor } from './network'
import { cachedFallback, fetchPrices, referencePrices } from './prices'
import { XSTOCKS } from './xstocks'
import { num, pct, signedPct, usd, usdCompact, xnft } from './format'

/** Every value a caller could see, checked for the three ways a number goes wrong. */
function expectFinite(label: string, value: number): void {
  expect(Number.isFinite(value), `${label} is not finite: ${value}`).toBe(true)
  expect(Object.is(value, -0), `${label} is negative zero`).toBe(false)
}

describe('fee constants', () => {
  it('holds the published rates', () => {
    // These are the numbers the docs, the mint page and the marketplace copy all
    // state. Nothing off-chain or on-chain cross-checks them any more, so pinning
    // them here is what turns a silent repricing into a failing test.
    expect(BPS_DENOM).toBe(10_000n)
    expect(SIM_SALE_FEE_BPS).toBe(500n)
    expect(SIM_RENT_FEE_BPS).toBe(1_000n)
    expect(MAX_FEE_BPS).toBe(2_000n)
    expect(MINT_BURN).toBe(10_000n)
  })

  it('keeps every live rate under the ceiling this module declares', () => {
    // MAX_FEE_BPS was once enforced by a program that rejected a higher config;
    // with the program gone it is a convention, and this assertion is now its
    // only enforcer. It binds the rates in this file and nothing outside it.
    expect(SIM_SALE_FEE_BPS).toBeLessThanOrEqual(MAX_FEE_BPS)
    expect(SIM_RENT_FEE_BPS).toBeLessThanOrEqual(MAX_FEE_BPS)
  })

  it('reads a rate back as a fraction for display', () => {
    expect(bpsFraction(SIM_SALE_FEE_BPS)).toBeCloseTo(0.05, 12)
    expect(bpsFraction(SIM_RENT_FEE_BPS)).toBeCloseTo(0.1, 12)
  })
})

/**
 * The structural half of "the mint fee is gone".
 *
 * Deleting the 500-token leg is only worth doing if nothing grows it back, and
 * the shape of the code is what prevents that: there is no mint quote with a fee
 * field, no mint bps constant, and no fee argument defaulting to zero. A test
 * that only checked `fee === 0` would pass for the very design this change
 * exists to remove.
 */
describe('the mint has no fee at all', () => {
  it('exposes one amount, not a gross/fee/total triple', () => {
    const amount = mintAmount(9)
    expect(typeof amount).toBe('bigint')
    // If mintAmount ever returns an object again, this is where it is caught.
    expect((amount as unknown as { fee?: unknown }).fee).toBeUndefined()
  })

  it('has no mint rate to apply', async () => {
    const fees = (await import('./fees')) as Record<string, unknown>
    const names = Object.keys(fees)
    // Only the two simulated-marketplace rates survive, and both say so in the
    // name. A `TRADE_FEE_BPS` or `MINT_FEE_BPS` reappearing here is the exact
    // regression this file is meant to catch.
    expect(names.filter((n) => n.endsWith('FEE_BPS')).sort()).toEqual([
      'MAX_FEE_BPS',
      'SIM_RENT_FEE_BPS',
      'SIM_SALE_FEE_BPS',
    ])
    expect(names).not.toContain('mintQuote')
    expect(names).not.toContain('MINT_FEE')
    expect(names).not.toContain('MINT_TOTAL')
  })

  it('debits exactly the burn — nothing rides on top', () => {
    for (let d = 0; d <= 15; d++) {
      expect(mintAmount(d)).toBe(MINT_BURN * 10n ** BigInt(d))
      expect(fromRawUnits(mintAmount(d), d)).toBe(10_000)
    }
  })

  it('refuses a decimal count it cannot scale exactly', () => {
    expect(() => mintAmount(19)).toThrow(RangeError)
    expect(() => mintAmount(-1)).toThrow(RangeError)
    expect(() => mintAmount(1.5)).toThrow(RangeError)
  })

  it('defaults to the placeholder decimals the UI uses before the mint exists', () => {
    expect(mintAmount()).toBe(mintAmount(XNFT_DECIMALS))
  })
})

describe('feeOn', () => {
  it('takes 5% of a round amount', () => {
    expect(feeOn(10_000n, SIM_SALE_FEE_BPS)).toBe(500n)
    expect(feeOn(1_000_000n, SIM_SALE_FEE_BPS)).toBe(50_000n)
  })

  it('takes 10% for rentals', () => {
    expect(feeOn(10_000n, SIM_RENT_FEE_BPS)).toBe(1_000n)
  })

  /**
   * The single most important property in this file: the fee floors. Rounding up
   * would take a unit off the payer that no quote ever showed them — and since
   * `spl.ts` builds its rent transfer amounts from these same functions, the
   * wallet prompt would carry the overcharge with the screen still reading the
   * old number.
   */
  it('floors at one raw unit', () => {
    // 19 * 500 / 10000 = 0.95 -> 0. The treasury takes nothing rather than a unit.
    expect(feeOn(19n, SIM_SALE_FEE_BPS)).toBe(0n)
    expect(feeOn(20n, SIM_SALE_FEE_BPS)).toBe(1n)
    expect(feeOn(39n, SIM_SALE_FEE_BPS)).toBe(1n)
    expect(feeOn(40n, SIM_SALE_FEE_BPS)).toBe(2n)
    // 9 * 1000 / 10000 = 0.9 -> 0.
    expect(feeOn(9n, SIM_RENT_FEE_BPS)).toBe(0n)
    expect(feeOn(10n, SIM_RENT_FEE_BPS)).toBe(1n)
  })

  it('never rounds up, across a dense sweep of amounts and rates', () => {
    for (const bps of [
      0n,
      1n,
      250n,
      SIM_SALE_FEE_BPS,
      SIM_RENT_FEE_BPS,
      MAX_FEE_BPS,
      9_999n,
      BPS_DENOM,
    ]) {
      for (let gross = 0n; gross < 400n; gross++) {
        const fee = feeOn(gross, bps)
        const exact = gross * bps
        expect(fee * BPS_DENOM).toBeLessThanOrEqual(exact)
        expect(fee * BPS_DENOM + BPS_DENOM).toBeGreaterThan(exact)
      }
    }
  })

  it('handles the bps boundaries exactly', () => {
    expect(feeOn(123_456_789n, 0n)).toBe(0n)
    expect(feeOn(123_456_789n, BPS_DENOM)).toBe(123_456_789n)
    expect(feeOn(1n, 1n)).toBe(0n)
    expect(feeOn(BPS_DENOM, 1n)).toBe(1n)
    expect(feeOn(0n, SIM_SALE_FEE_BPS)).toBe(0n)
  })

  it('stays exact past the range a double could hold', () => {
    // 2^53 is where Number stops counting; raw units on a 9-decimal mint blow
    // past it at ~9M tokens, which is well inside a plausible treasury balance.
    const gross = 9_007_199_254_740_993n * 1_000n
    expect(feeOn(gross, SIM_SALE_FEE_BPS)).toBe((gross * 500n) / 10_000n)
    expect(feeOn(gross, SIM_SALE_FEE_BPS) * 20n).toBe(gross)
  })

  it('refuses nonsense rather than returning a plausible wrong number', () => {
    expect(() => feeOn(-1n, SIM_SALE_FEE_BPS)).toThrow(RangeError)
    expect(() => feeOn(100n, -1n)).toThrow(RangeError)
    expect(() => feeOn(100n, BPS_DENOM + 1n)).toThrow(RangeError)
  })
})

describe('totalWithFee', () => {
  it('is exactly gross plus the fee', () => {
    for (let gross = 0n; gross < 200n; gross++) {
      expect(totalWithFee(gross, SIM_RENT_FEE_BPS)).toBe(gross + feeOn(gross, SIM_RENT_FEE_BPS))
    }
  })

  it('never charges less than the gross — the fee rides on top', () => {
    for (let gross = 0n; gross < 200n; gross++) {
      expect(totalWithFee(gross, SIM_SALE_FEE_BPS)).toBeGreaterThanOrEqual(gross)
    }
  })

  it('is monotonic in the amount', () => {
    let prev = -1n
    for (let gross = 0n; gross < 500n; gross++) {
      const total = totalWithFee(gross, SIM_SALE_FEE_BPS)
      expect(total).toBeGreaterThan(prev)
      prev = total
    }
  })

  it('agrees with quoteFor', () => {
    const q = quoteFor(777n, SIM_RENT_FEE_BPS)
    expect(q.total).toBe(totalWithFee(777n, SIM_RENT_FEE_BPS))
    expect(q.gross + q.fee).toBe(q.total)
    expect(q.bps).toBe(SIM_RENT_FEE_BPS)
  })
})

describe('raw unit conversion', () => {
  it('round-trips whole tokens', () => {
    for (const amount of [0, 1, 42, 10_000, 123_456]) {
      expect(fromRawUnits(toRawUnits(amount, XNFT_DECIMALS), XNFT_DECIMALS)).toBe(amount)
    }
  })

  it('converts in decimal digits, not binary ones', () => {
    // 0.07 * 1e9 in floating point is 70000000.00000001; the naive multiply then
    // truncates to 70000000 by luck and 0.29 * 1e8 does not. Decimal conversion
    // has no luck in it.
    expect(toRawUnits(0.07, 9)).toBe(70_000_000n)
    expect(toRawUnits(0.29, 8)).toBe(29_000_000n)
    expect(toRawUnits(1.1, 2)).toBe(110n)
    expect(toRawUnits(8.245, 3)).toBe(8_245n)
  })

  it('handles a zero-decimal mint', () => {
    expect(toRawUnits(10_000, 0)).toBe(10_000n)
    expect(fromRawUnits(10_000n, 0)).toBe(10_000)
  })

  it('rejects inputs it cannot convert exactly', () => {
    expect(() => toRawUnits(NaN, 9)).toThrow(RangeError)
    expect(() => toRawUnits(Infinity, 9)).toThrow(RangeError)
    expect(() => toRawUnits(-1, 9)).toThrow(RangeError)
    expect(() => toRawUnits(1e21, 9)).toThrow(RangeError)
    expect(() => toRawUnits(1, 19)).toThrow(RangeError)
    expect(() => toRawUnits(1, -1)).toThrow(RangeError)
    expect(() => toRawUnits(1, 1.5)).toThrow(RangeError)
  })

  /**
   * The display side of the finiteness rule. `fromRawUnits` is what turns every
   * balance, shortfall and quote into the string a visitor reads, so it is the
   * single widest funnel for a NaN to reach the page through.
   *
   * -0 is checked as carefully as NaN because it is the failure nobody catches in
   * review: the value is arithmetically correct and the column reads "-0".
   */
  it('is finite and never -0 for every raw value at every decimals it accepts', () => {
    const u64Max = 2n ** 64n - 1n
    for (let d = 0; d <= 18; d++) {
      const base = 10n ** BigInt(d)
      for (const raw of [0n, 1n, base - 1n, base, base + 1n, 10_000n * base, u64Max]) {
        expectFinite(`fromRawUnits(${raw}, ${d})`, fromRawUnits(raw, d))
      }
      expect(fromRawUnits(0n, d)).toBe(0)
    }
  })
})

describe('saleQuote', () => {
  it('leaves the seller whole and puts the fee on the buyer', () => {
    const q = saleQuote(6_600, XNFT_DECIMALS)
    expect(fromRawUnits(q.gross, XNFT_DECIMALS)).toBe(6_600)
    expect(fromRawUnits(q.fee, XNFT_DECIMALS)).toBe(330)
    expect(fromRawUnits(q.total, XNFT_DECIMALS)).toBe(6_930)
  })

  it('charges nothing extra when the fee floors away', () => {
    // 19 raw units at 5% is 0.95 of a unit, so the buyer pays exactly the ask.
    const q = saleQuote(0.000000019, 9)
    expect(q.gross).toBe(19n)
    expect(q.fee).toBe(0n)
    expect(q.total).toBe(19n)
  })

  it('is zero all the way down for a free listing', () => {
    const q = saleQuote(0, XNFT_DECIMALS)
    expect(q.gross).toBe(0n)
    expect(q.fee).toBe(0n)
    expect(q.total).toBe(0n)
  })
})

describe('rentQuote', () => {
  it('charges 10% of the whole term', () => {
    const q = rentQuote(100, 30, XNFT_DECIMALS)
    expect(fromRawUnits(q.gross, XNFT_DECIMALS)).toBe(3_000)
    expect(fromRawUnits(q.fee, XNFT_DECIMALS)).toBe(300)
    expect(fromRawUnits(q.total, XNFT_DECIMALS)).toBe(3_300)
    expect(q.term).toBe(30)
    expect(fromRawUnits(q.perEpoch, XNFT_DECIMALS)).toBe(100)
  })

  /**
   * Flooring once on the contract total is not the same as flooring per epoch,
   * and the difference is the entire fee on a small listing. A rental is one fee
   * transfer, so the arithmetic floors once.
   */
  it('floors the fee once on the total, not once per epoch', () => {
    const q = rentQuote(0.000000009, 100, 9)
    expect(q.perEpoch).toBe(9n)
    expect(q.gross).toBe(900n)
    expect(q.fee).toBe(90n)
    // Per-epoch flooring would have collected nothing at all.
    expect(feeOn(9n, SIM_RENT_FEE_BPS) * 100n).toBe(0n)
  })

  it('is zero for a zero-length contract and does not divide by anything', () => {
    const q = rentQuote(12.5, 0, XNFT_DECIMALS)
    expect(q.gross).toBe(0n)
    expect(q.fee).toBe(0n)
    expect(q.total).toBe(0n)
  })

  it('rejects a fractional or negative term', () => {
    expect(() => rentQuote(1, -1, XNFT_DECIMALS)).toThrow(RangeError)
    expect(() => rentQuote(1, 2.5, XNFT_DECIMALS)).toThrow(RangeError)
  })
})

describe('contractMath', () => {
  const listing = (feePerEpoch: number, term: number): ContractListing => ({
    kind: 'contract',
    xployee: buildXployee(3, 0),
    feePerEpoch,
    term,
    listedAt: 0,
  })

  it('reports the same numbers the fee engine produces', () => {
    const l = listing(12.34, 14)
    const m = contractMath(l)
    const q = rentQuote(l.feePerEpoch, l.term, XNFT_DECIMALS)
    expect(m.grossXnft).toBe(fromRawUnits(q.gross, XNFT_DECIMALS))
    expect(m.feeXnft).toBe(fromRawUnits(q.fee, XNFT_DECIMALS))
    expect(m.costXnft).toBe(fromRawUnits(q.total, XNFT_DECIMALS))
  })

  it('costs the renter the fee — the old margin was for a trade nobody could make', () => {
    const m = contractMath(listing(100, 30))
    expect(m.costXnft).toBeCloseTo(m.grossXnft * 1.1, 6)
    expect(m.marginXnft).toBeCloseTo(m.projectedYieldXnft - m.costXnft, 8)
    // Whatever the yield, the fee always costs the renter exactly the fee.
    const feeless = m.projectedYieldXnft - m.grossXnft
    expect(feeless - m.marginXnft).toBeCloseTo(m.feeXnft, 8)
  })

  /**
   * Spec 3.3: with the fee on top, a renter breaks even at a listing spread of
   * 1/1.1 rather than 1.0. Listings are drawn from 0.7-1.4x, so a spread just
   * under the break-even must be profitable and one just over must not.
   */
  it('moves renter break-even from a 1.00x spread to 0.909x', () => {
    const x = buildXployee(3, 0)
    const term = 30
    // One epoch of expected output, priced in $xNFT — the unit a spread scales.
    const expectedPerEpoch = yieldPerEpoch(x) / XNFT_USD

    const atBreakEven = contractMath(listing(expectedPerEpoch / 1.1, term))
    expect(Math.abs(atBreakEven.marginPct)).toBeLessThan(0.001)

    expect(contractMath(listing(expectedPerEpoch * 0.9, term)).marginXnft).toBeGreaterThan(0)
    expect(contractMath(listing(expectedPerEpoch * 0.95, term)).marginXnft).toBeLessThan(0)
    // The spread that used to read as break-even is now a loss.
    expect(contractMath(listing(expectedPerEpoch, term)).marginXnft).toBeLessThan(0)
  })

  it('does not divide by zero on a free contract', () => {
    const m = contractMath(listing(0, 0))
    expect(m.marginPct).toBe(0)
    for (const [k, v] of Object.entries(m)) expectFinite(`contractMath.${k}`, v)
  })
})

/**
 * The arbitrage guard.
 *
 * Minting is meant to be an EV-neutral tier lottery. Two earlier pricings handed
 * out roughly 26% for free; if a future tune to XNFT_USD, MINT_BURN, the tier
 * table or the skill APYs reopens that gap, this fails rather than quietly
 * minting free money.
 *
 * Every line of the derivation recorded on XNFT_USD is recomputed here from
 * SKILLS and TIERS rather than copied, so a reader can check the comment against
 * running code and an edit to either table moves both.
 */
describe('mint economics', () => {
  /** randInt(60, 100) / 100 — the proficiency roll every skill gets. */
  const MEAN_PROFICIENCY = 0.8
  /** The discount rate `fairValueXnft` capitalises yield at. */
  const YIELD_CAP_RATE = 0.18
  const TOLERANCE = 0.02

  /** What one mint debits, in USD. With no fee this is the burn and nothing else. */
  function mintCostUsd(): number {
    return fromRawUnits(mintAmount(XNFT_DECIMALS), XNFT_DECIMALS) * XNFT_USD
  }

  /**
   * E[fair value] from the population parameters rather than from a sample, so
   * the assertion below tracks the constants and not the luck of 512 draws.
   */
  function modelFairValueUsd(): number {
    const totalWeight = SKILLS.reduce((sum, s) => sum + s.weight, 0)
    const meanBaseApy = SKILLS.reduce((sum, s) => sum + s.baseApy * s.weight, 0) / totalWeight
    const meanApy = meanBaseApy * MEAN_PROFICIENCY
    const meanPrincipal = TIERS.reduce((sum, t) => sum + t.supply * principalFor(t), 0)
    return meanPrincipal * (1 + meanApy / YIELD_CAP_RATE)
  }

  it('reproduces the derivation recorded on XNFT_USD, line by line', () => {
    const totalWeight = SKILLS.reduce((sum, s) => sum + s.weight, 0)
    const meanBaseApy = SKILLS.reduce((sum, s) => sum + s.baseApy * s.weight, 0) / totalWeight
    expect(totalWeight).toBe(144)
    expect(meanBaseApy).toBeCloseTo(0.058007, 6)
    expect(meanBaseApy * MEAN_PROFICIENCY).toBeCloseTo(0.046406, 6)
    expect(TIERS.reduce((sum, t) => sum + t.supply * principalFor(t), 0)).toBeCloseTo(1_580, 9)
    expect(modelFairValueUsd()).toBeCloseTo(1_987.34, 2)
    expect(mintCostUsd()).toBeCloseTo(2_000, 9)
  })

  it('prices $xNFT within a cent of EV-neutral', () => {
    // The neutral price is fair value spread over the tokens a mint costs. 0.20
    // is that number rounded to the cent a docs page can print.
    const neutral = modelFairValueUsd() / Number(MINT_BURN)
    expect(neutral).toBeCloseTo(0.1987, 4)
    expect(Math.abs(XNFT_USD - neutral)).toBeLessThan(0.01)
  })

  it('keeps mint EV within 2% of fair value', () => {
    const edge = mintCostUsd() / modelFairValueUsd() - 1
    expect(Math.abs(edge)).toBeLessThanOrEqual(TOLERANCE)
    // The direction matters as much as the size: a buyer paying under fair value
    // is being handed money, which is the failure this whole block exists for.
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeCloseTo(0.0064, 4)
  })

  it('keeps the figure quoted in the docs honest', () => {
    expect(Math.abs(EXPECTED_MINT_VALUE_USD / modelFairValueUsd() - 1)).toBeLessThanOrEqual(TOLERANCE)
  })

  /**
   * The same check against the units that actually exist. The generator is
   * deterministic, so this is a fixed number rather than a sample. Worth knowing
   * that the standard error on a mean of 512 draws is itself around 2%: shrink
   * the population much further and this can brush the band on sampling noise
   * alone, at which point the model-based assertion above is the one still
   * guarding the pricing.
   */
  it('agrees with the collection that was actually generated', () => {
    const all = collection()
    const meanFairValueUsd = all.reduce((sum, x) => sum + fairValueXnft(x) * XNFT_USD, 0) / all.length
    expect(Math.abs(mintCostUsd() / meanFairValueUsd - 1)).toBeLessThanOrEqual(TOLERANCE)
  })

  it('leaves the floor below mint cost, so yield buyers buy the floor', () => {
    // An UNCOMMON at the mean rate is the cheapest thing the market offers; if
    // it ever cost more than a mint, minting would stop being a lottery and
    // become the only sensible purchase.
    const uncommon = TIERS[0]
    const meanApy =
      (SKILLS.reduce((sum, s) => sum + s.baseApy * s.weight, 0) /
        SKILLS.reduce((sum, s) => sum + s.weight, 0)) *
      MEAN_PROFICIENCY
    const floorUsd = principalFor(uncommon) * (1 + meanApy / YIELD_CAP_RATE)
    expect(floorUsd).toBeLessThan(mintCostUsd())
  })
})

/**
 * The book figures have to agree with each other, not merely each be plausible.
 *
 * Four numbers describe the same worker from four angles — blended APY, book
 * value, trailing APY and yield per epoch — and the site shows all four at once
 * on the xployee sheet. Any pair of them disagreeing is visible to a reader doing
 * arithmetic in their head, which is exactly the kind of reader this product
 * attracts.
 */
describe('the book figures agree with each other', () => {
  const now = Date.UTC(2026, 5, 1)
  /** One of each tier, so 1-, 2-, 3- and 4-skill workers are all covered. */
  const sample = [0, 200, 1_000, 3_000].map((id) => buildXployee(id, Date.UTC(2026, 0, 20)))

  it('lays every sample out across the tiers it claims to', () => {
    expect(sample.map((x) => x.tier.skills)).toEqual([4, 3, 2, 1])
    for (const x of sample) expect(x.tier).toBe(tierForId(x.id, MAX_SUPPLY))
  })

  it('makes book value exactly principal plus accrual', () => {
    for (const x of sample) {
      expect(bookValue(x, now)).toBe(x.principal + accruedTotal(x, now))
      // Per-skill accrual sums to the total: no skill's share is lost or double
      // counted, which is what the desk breakdown on the sheet asserts visually.
      const bySkill = accruedBySkill(x, now).reduce((sum, r) => sum + r.usd, 0)
      expect(bySkill).toBeCloseTo(accruedTotal(x, now), 9)
    }
  })

  it('accrues at exactly the blended APY the badge prints', () => {
    for (const x of sample) {
      expect(x.apy).toBeCloseTo(blendedApy(x.skills), 15)
      const years = tenureYears(x, now)
      expect(accruedTotal(x, now)).toBeCloseTo(x.principal * x.apy * years, 6)
    }
  })

  it('makes yield per epoch the annual rate divided by the epoch count', () => {
    for (const x of sample) {
      expect(yieldPerEpoch(x) * EPOCHS_PER_YEAR).toBeCloseTo(x.principal * x.apy, 9)
      // One epoch of accrual is one epoch of yield — the renter's unit and the
      // owner's unit are the same unit.
      const oneEpoch = accruedTotal(x, x.hiredAt + EPOCH_MS) - accruedTotal(x, x.hiredAt)
      expect(oneEpoch).toBeCloseTo(yieldPerEpoch(x), 9)
    }
  })

  /**
   * Trailing APY is a return on average NAV, so it sits *below* the nominal rate
   * once a book has accrued anything — the denominator has grown and the
   * numerator has not. That relationship is the one a reader spots.
   */
  it('reports a trailing rate consistent with the nominal one', () => {
    for (const x of sample) {
      const reading = trailingApy(x, now)
      expectFinite('trailingApy.rate', reading.rate)
      expect(reading.estimated).toBe(false)

      const windowMs = 30 * EPOCH_MS
      const avgNav = (bookValue(x, now - windowMs) + bookValue(x, now)) / 2
      expect(reading.rate).toBeCloseTo((x.principal * x.apy) / avgNav, 12)
      expect(reading.rate).toBeLessThanOrEqual(x.apy)
      expect(reading.rate).toBeGreaterThan(0)
    }
  })

  it('ties renter margin to the same yield the owner is credited', () => {
    for (const x of sample) {
      const listing: ContractListing = {
        kind: 'contract',
        xployee: x,
        feePerEpoch: 4.25,
        term: 14,
        listedAt: 0,
      }
      const m = contractMath(listing)
      expect(m.projectedYieldXnft).toBeCloseTo((yieldPerEpoch(x) * listing.term) / XNFT_USD, 9)
      expect(m.marginXnft).toBeCloseTo(m.projectedYieldXnft - m.costXnft, 9)
      expect(m.marginPct).toBeCloseTo(m.marginXnft / m.costXnft, 12)
      for (const [k, v] of Object.entries(m)) expectFinite(`contractMath.${k}`, v)
    }
  })

  it('sums the same accrual into the earnings a wallet can request', () => {
    const earnings = earningsFor(sample, now)
    expect(earnings.accruedUsd).toBeCloseTo(
      sample.reduce((sum, x) => sum + accruedTotal(x, now), 0),
      9,
    )
    expect(earnings.claimableUsd).toBe(earnings.accruedUsd)
    expect(earnings.claimableSol).toBeCloseTo(earnings.claimableUsd / SOL_USD, 12)
    expect(earnings.crewSize).toBe(sample.length)
  })

  it('prices a fair-value sale at the capitalised yield the book implies', () => {
    for (const x of sample) {
      // fairValueXnft is principal plus yield capitalised at 18%, converted at
      // XNFT_USD. Restated here so a change to either half fails visibly.
      expect(fairValueXnft(x) * XNFT_USD).toBeCloseTo(
        x.principal + (x.principal * x.apy) / 0.18,
        9,
      )
    }
  })
})

/**
 * The three states that produce a NaN.
 *
 * Each of these is a real screen someone lands on: a wallet that has never held
 * anything, a worker hired a millisecond ago, and a price API that is down. All
 * three used to be the sort of thing that got noticed in production.
 */
describe('every displayed figure is finite in the degenerate states', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('a wallet holding nothing reads zero, not NaN', () => {
    const now = Date.now()
    const earnings = earningsFor([], now)
    for (const [k, v] of Object.entries(earnings)) expectFinite(`earnings.${k}`, v)
    expect(earnings.accruedUsd).toBe(0)
    expect(earnings.claimableUsd).toBe(0)
    expect(earnings.claimableSol).toBe(0)
    expect(canRequest(earnings)).toBe(false)

    // The same wallet on the ladder: rank is defined at zero and the distance to
    // the next rung is a real number rather than a subtraction from nothing.
    expect(xBossFor(0)).toBe('BOSS')
    const next = nextRank(0)
    expect(next).not.toBeNull()
    expectFinite('nextRank.remaining', next!.remaining)

    // And a request larger than the balance clamps to zero rather than going
    // negative, so no screen can show a wallet owing the protocol money.
    const overdrawn = earningsFor([], now, [
      { id: 'XN-AAAAA-BBBBB', address: 'x', amountUsd: 5, amountSol: usdToSol(5), requestedAt: now, status: 'pending' },
    ])
    expect(overdrawn.claimableUsd).toBe(0)
    expect(Object.is(overdrawn.claimableUsd, -0)).toBe(false)
  })

  it('a brand-new xployee at t = 0 has earned exactly nothing', () => {
    // Every tier, because a 1-skill worker divides principal by 1 and a 4-skill
    // worker by 4 — the division that would produce NaN on an empty skill list.
    for (const id of [0, 200, 1_000, 3_000]) {
      const hiredAt = Date.now()
      const x = buildXployee(id, hiredAt)
      expect(x.skills.length).toBeGreaterThan(0)

      expectFinite('apy', x.apy)
      expect(tenureYears(x, hiredAt)).toBe(0)
      expect(accruedTotal(x, hiredAt)).toBe(0)
      expect(Object.is(accruedTotal(x, hiredAt), -0)).toBe(false)
      expect(bookValue(x, hiredAt)).toBe(x.principal)
      expectFinite('yieldPerEpoch', yieldPerEpoch(x))

      // The window is zero wide, so the trailing figure has nothing to divide by
      // and falls back to the nominal rate rather than to 0/0.
      const reading = trailingApy(x, hiredAt)
      expectFinite('trailingApy.rate at t=0', reading.rate)
      expect(reading.rate).toBe(x.apy)
      expect(reading.estimated).toBe(true)

      // A clock that has run backwards — a stale render, a machine with a bad
      // time — must not produce negative accrual or a negative book.
      const before = hiredAt - EPOCH_MS
      expect(accruedTotal(x, before)).toBe(0)
      expect(bookValue(x, before)).toBe(x.principal)
      expectFinite('trailingApy.rate before hire', trailingApy(x, before).rate)
    }
  })

  it('blends nothing to zero rather than to NaN', () => {
    // The guard that keeps the case above from dividing by an empty array.
    expect(blendedApy([])).toBe(0)
  })

  it('a price feed that returns nothing still prices every desk', async () => {
    const cached = cachedFallback()
    expect(cached.source).toBe('cached')
    for (const stock of XSTOCKS) {
      const price = cached.bySymbol[stock.symbol]
      expectFinite(`cached price ${stock.symbol}`, price)
      expect(price).toBeGreaterThan(0)
    }
    // Every ticker a skill can work has a price, so no desk row can render "$NaN".
    for (const skill of SKILLS) {
      expectFinite(`reference price ${skill.ticker}`, referencePrices()[skill.ticker])
    }

    for (const failure of [
      () => Promise.reject(new Error('offline')),
      () => Promise.resolve({ ok: false, json: async () => ({}) } as unknown as Response),
      () => Promise.resolve({ ok: true, json: async () => ({}) } as unknown as Response),
      () => Promise.resolve({ ok: true, json: async () => null } as unknown as Response),
      () =>
        Promise.resolve({
          ok: true,
          json: async () => ({ [XSTOCKS[0].mint]: { usdPrice: 0 } }),
        } as unknown as Response),
    ]) {
      vi.stubGlobal('fetch', vi.fn(failure))
      const result = await fetchPrices()
      expect(result.source).toBe('cached')
      for (const stock of XSTOCKS) {
        expectFinite(`degraded price ${stock.symbol}`, result.bySymbol[stock.symbol])
        expect(result.bySymbol[stock.symbol]).toBeGreaterThan(0)
      }
    }
  })

  it('keeps the network aggregates finite for every wallet', () => {
    const now = Date.now()
    for (const wallet of networkWallets(now)) {
      expectFinite(`${wallet.handle}.portfolioValue`, wallet.portfolioValue)
      expectFinite(`${wallet.handle}.yieldPerEpoch`, wallet.yieldPerEpoch)
      // Value-weighted APY divides by portfolio value, which is the division a
      // wallet holding nothing would zero out.
      expectFinite(`${wallet.handle}.avgApy`, wallet.avgApy)
      expect(wallet.avgApy).toBeGreaterThanOrEqual(0)
      expect(wallet.holdings).toBeGreaterThan(0)
    }

    const stats = networkStats(now)
    for (const [k, v] of Object.entries(stats)) expectFinite(`networkStats.${k}`, v)
  })

  /**
   * The last line of defence. Every figure above is finite by construction, but
   * the formatters are what a visitor actually reads, and two values print as a
   * defect even when the arithmetic behind them is right.
   */
  it('never renders NaN, Infinity or a negative zero', () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(usd(bad)).toBe('—')
      expect(num(bad)).toBe('—')
      expect(pct(bad)).toBe('—')
      expect(xnft(bad)).toBe('—')
      expect(usdCompact(bad)).toBe('—')
      expect(signedPct(bad)).toBe('—')
    }

    // Intl renders -0 as "-0" and "-$0.00". Both read as a bug in a money column.
    expect(num(-0)).toBe(num(0))
    expect(num(-0)).toBe('0')
    expect(usd(-0)).toBe('$0.00')
    expect(xnft(-0)).toBe(xnft(0))
    expect(usdCompact(-0)).toBe(usdCompact(0))
    expect(pct(-0)).toBe('0.00%')
    // A flat reading points up, not down.
    expect(signedPct(-0)).toBe(signedPct(0))

    // A genuine small negative is still negative — the normalisation is for -0
    // alone and must not swallow a real loss that rounds to nothing on screen.
    expect(pct(-0.00004, 2)).toBe('-0.00%')
    expect(signedPct(-0.4)).toContain('▼')
  })

  it('keeps the marketplace floor a real number even with nothing listed', () => {
    // floorPrice seeds its reduce with Infinity, so the empty case has to be
    // caught before the reduce runs — which is exactly what it does.
    const floor = floorPrice()
    expectFinite('floorPrice', floor)
    expect(saleListings().length > 0 ? floor > 0 : floor === 0).toBe(true)
    for (const listing of saleListings()) {
      expectFinite(`listing ${listing.xployee.id}.price`, listing.price)
      expect(listing.price).toBeGreaterThanOrEqual(floor)
    }
  })
})
