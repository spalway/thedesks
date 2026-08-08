import { describe, it, expect } from 'vitest'
import {
  CLAIM_ID_RE,
  MIN_REQUEST_USD,
  SOL_USD,
  SOL_USD_FALLBACK,
  accruedUsd,
  canRequest,
  createRequest,
  earningsFor,
  formatSol,
  isClaimId,
  newClaimId,
  requestedUsd,
  roundCents,
  solToUsd,
  usdToSol,
  type PaymentRequest,
} from './earnings'
import { EPOCH_MS, EPOCHS_PER_YEAR, GENESIS, accruedTotal } from './accrual'
import { buildXployee } from './xployee'

const HIRED_AT = Date.UTC(2026, 0, 6)
const YEAR_MS = EPOCH_MS * EPOCHS_PER_YEAR

/** One deterministic worker. Same id, same tier, same skills, forever. */
const one = buildXployee(3, HIRED_AT)

const pending = (amountUsd: number, at = HIRED_AT): PaymentRequest => ({
  id: 'XN-ABCDE-12345',
  address: 'wallet',
  amountUsd,
  amountSol: usdToSol(amountUsd),
  requestedAt: at,
  status: 'pending',
})

describe('a wallet with no crew', () => {
  it('has nothing accrued, nothing claimable and nothing to convert', () => {
    const e = earningsFor([], HIRED_AT + YEAR_MS)
    expect(e.accruedUsd).toBe(0)
    expect(e.requestedUsd).toBe(0)
    expect(e.claimableUsd).toBe(0)
    expect(e.claimableSol).toBe(0)
    expect(e.crewSize).toBe(0)
  })

  it('cannot request, no matter how long it waits', () => {
    for (const days of [0, 1, 30, 365, 3_650]) {
      expect(canRequest(earningsFor([], HIRED_AT + days * EPOCH_MS))).toBe(false)
    }
  })
})

describe('a wallet with one xployee', () => {
  it('earns exactly what that xployee accrued — the figure is derived, not invented', () => {
    const now = HIRED_AT + YEAR_MS
    const e = earningsFor([one], now)
    expect(e.accruedUsd).toBe(accruedTotal(one, now))
    expect(e.claimableUsd).toBe(e.accruedUsd)
    expect(e.crewSize).toBe(1)
  })

  it('is exactly zero at the moment of hire, and cannot request', () => {
    const e = earningsFor([one], HIRED_AT)
    expect(e.accruedUsd).toBe(0)
    expect(canRequest(e)).toBe(false)
  })

  /** A year on a $1k+ book at ~5% is tens of dollars — comfortably requestable. */
  it('is requestable after a year of work', () => {
    const e = earningsFor([one], HIRED_AT + YEAR_MS)
    expect(e.claimableUsd).toBeGreaterThan(MIN_REQUEST_USD)
    expect(canRequest(e)).toBe(true)
  })

  it('converts to SOL at the one rate, both ways', () => {
    const e = earningsFor([one], HIRED_AT + YEAR_MS)
    expect(e.claimableSol).toBeCloseTo(e.claimableUsd / SOL_USD, 12)
    expect(solToUsd(e.claimableSol)).toBeCloseTo(e.claimableUsd, 8)
  })

  it('sums across a crew rather than reporting the largest', () => {
    const crew = [buildXployee(3, HIRED_AT), buildXployee(7, HIRED_AT), buildXployee(11, HIRED_AT)]
    const now = HIRED_AT + YEAR_MS
    expect(earningsFor(crew, now).accruedUsd).toBeCloseTo(
      crew.reduce((sum, x) => sum + accruedTotal(x, now), 0),
      10,
    )
  })
})

describe('growth over time', () => {
  it('is strictly monotonic — a wallet never earns less than it did a second ago', () => {
    const times = [0, 1_000, 60_000, EPOCH_MS, 7 * EPOCH_MS, 30 * EPOCH_MS, YEAR_MS, 3 * YEAR_MS]
    let prev = -1
    for (const offset of times) {
      const value = earningsFor([one], HIRED_AT + offset).claimableUsd
      expect(value).toBeGreaterThan(prev)
      prev = value
    }
  })

  it('grows linearly — twice the tenure is twice the yield', () => {
    const oneYear = accruedUsd([one], HIRED_AT + YEAR_MS)
    const twoYears = accruedUsd([one], HIRED_AT + 2 * YEAR_MS)
    expect(twoYears).toBeCloseTo(oneYear * 2, 8)
  })

  it('does not run backwards before the hire date', () => {
    expect(accruedUsd([one], HIRED_AT - YEAR_MS)).toBe(0)
  })

  it('stays monotonic in SOL as well as USD', () => {
    const a = earningsFor([one], HIRED_AT + EPOCH_MS).claimableSol
    const b = earningsFor([one], HIRED_AT + 2 * EPOCH_MS).claimableSol
    expect(b).toBeGreaterThan(a)
  })
})

describe('netting against the queue', () => {
  it('subtracts what has already been asked for', () => {
    const now = HIRED_AT + YEAR_MS
    const gross = accruedUsd([one], now)
    const e = earningsFor([one], now, [pending(10)])
    expect(e.requestedUsd).toBe(10)
    expect(e.claimableUsd).toBeCloseTo(gross - 10, 10)
  })

  it('releases a rejected request back to the wallet', () => {
    const now = HIRED_AT + YEAR_MS
    const rejected: PaymentRequest = { ...pending(10), status: 'rejected' }
    expect(requestedUsd([rejected])).toBe(0)
    expect(earningsFor([one], now, [rejected]).claimableUsd).toBe(accruedUsd([one], now))
  })

  it('still counts a settled payout — paid money is not claimable twice', () => {
    expect(requestedUsd([{ ...pending(10), status: 'paid' }])).toBe(10)
  })

  it('clamps at zero rather than going negative', () => {
    const e = earningsFor([one], HIRED_AT + EPOCH_MS, [pending(1_000_000)])
    expect(e.claimableUsd).toBe(0)
    expect(e.claimableSol).toBe(0)
    expect(canRequest(e)).toBe(false)
  })
})

describe('claim IDs', () => {
  it('reads as XN-XXXXX-XXXXX', () => {
    expect(newClaimId()).toMatch(CLAIM_ID_RE)
    expect(isClaimId(newClaimId())).toBe(true)
  })

  /**
   * The property the format exists for: nothing in a claim ID is ambiguous read
   * aloud or retyped from a screenshot.
   */
  it('never draws a glyph that could be mistaken for another', () => {
    for (let i = 0; i < 500; i++) {
      expect(newClaimId()).not.toMatch(/[ILOU]/)
    }
  })

  it('does not collide across a realistic burst', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 5_000; i++) seen.add(newClaimId())
    expect(seen.size).toBe(5_000)
  })

  it('rejects anything that is not one of ours', () => {
    expect(isClaimId('')).toBe(false)
    expect(isClaimId('XN-ABCDE')).toBe(false)
    expect(isClaimId('AB-ABCDE-12345')).toBe(false)
    expect(isClaimId('XN-ABCDE-1234I')).toBe(false)
    expect(isClaimId('xn-abcde-12345')).toBe(false)
    expect(isClaimId(42)).toBe(false)
  })
})

describe('creating a request', () => {
  it('snapshots the amount the visitor was shown, to the cent', () => {
    const now = HIRED_AT + YEAR_MS
    const e = earningsFor([one], now)
    const r = createRequest('wallet', e, now)
    expect(r.amountUsd).toBe(roundCents(e.claimableUsd))
    expect(r.amountSol).toBeCloseTo(r.amountUsd / SOL_USD, 12)
    expect(r.requestedAt).toBe(now)
    expect(r.status).toBe('pending')
    expect(r.address).toBe('wallet')
    expect(isClaimId(r.id)).toBe(true)
  })

  it('never issues the same claim ID twice', () => {
    const e = earningsFor([one], HIRED_AT + YEAR_MS)
    expect(createRequest('wallet', e, 1).id).not.toBe(createRequest('wallet', e, 2).id)
  })
})

describe('formatting', () => {
  it('renders SOL at four decimals with its unit', () => {
    expect(formatSol(0.0694)).toBe('0.0694 SOL')
    expect(formatSol(0)).toBe('0.0000 SOL')
  })

  it('rounds cents without drifting', () => {
    expect(roundCents(12.499)).toBe(12.5)
    expect(roundCents(12.494)).toBe(12.49)
    expect(roundCents(0)).toBe(0)
  })

  it('returns zero rather than NaN for a figure that is not a number', () => {
    expect(usdToSol(Number.NaN)).toBe(0)
    expect(solToUsd(Number.POSITIVE_INFINITY)).toBe(0)
    expect(roundCents(Number.NaN)).toBe(0)
  })
})

describe('the SOL rate', () => {
  // What went wrong: SOL_USD was a hardcoded 180 labelled "placeholder", and it
  // was rendered to the visitor as "at $180 / SOL". Live SOL was $74.81 when
  // that was caught — the payout page overstated the rate 2.4x and therefore
  // understated every payout by the same factor, on the one page where the
  // number is money.

  it('converts at the rate it is given, not a constant', () => {
    expect(usdToSol(150, 75)).toBe(2)
    expect(usdToSol(150, 150)).toBe(1)
    expect(solToUsd(2, 75)).toBe(150)
  })

  it('threads the live rate all the way to claimableSol', () => {
    // The regression that matters. earningsFor computed claimableSol through a
    // constant, so a correct live price on the page still produced a wrong SOL
    // figure underneath it.
    const crew = [buildXployee(0, GENESIS)]
    const now = GENESIS + 90 * EPOCH_MS
    const cheap = earningsFor(crew, now, [], 75)
    const dear = earningsFor(crew, now, [], 150)
    expect(cheap.claimableUsd).toBe(dear.claimableUsd)
    // Half the price, twice the SOL.
    expect(cheap.claimableSol).toBeCloseTo(dear.claimableSol * 2, 12)
    expect(cheap.claimableSol).toBeCloseTo(cheap.claimableUsd / 75, 12)
  })

  it('falls back rather than dividing by a broken rate', () => {
    // A feed returning 0 would make a payout Infinity; NaN would make it NaN.
    // Both would reach a page that quotes what someone is owed.
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(`${bad}: ${usdToSol(300, bad)}`).toBe(`${bad}: ${300 / SOL_USD_FALLBACK}`)
      expect(Number.isFinite(solToUsd(1, bad))).toBe(true)
    }
  })

  it('defaults to the fallback when no rate is passed', () => {
    expect(usdToSol(SOL_USD_FALLBACK)).toBe(1)
  })
})
