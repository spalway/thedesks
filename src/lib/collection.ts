// The simulated collection. Deterministic, so 512 hired workers regenerate
// identically on every machine with no database behind them.
import { buildXployee, MAX_SUPPLY, type Xployee } from './xployee'
import { EPOCH_MS, GENESIS, epochAt } from './accrual'
import { rngFrom } from './rng'
import { TIERS, type TierId } from './tiers'

export const HIRED_COUNT = 512

/**
 * Hire times are spread deterministically from genesis to "now-ish". Using a
 * fixed reference instead of Date.now() keeps the collection stable — only
 * accrual moves with the clock.
 */
const HIRING_WINDOW_EPOCHS = 180

/** Keyed on mint POSITION, not serial — earlier mints hire earlier. */
function hireTimeFor(position: number): number {
  const rng = rngFrom('hire', String(position))
  const base = (position / HIRED_COUNT) * HIRING_WINDOW_EPOCHS
  const jitterEpochs = (rng() - 0.5) * 4
  const epoch = Math.max(0, Math.min(HIRING_WINDOW_EPOCHS, base + jitterEpochs))
  return GENESIS + epoch * EPOCH_MS
}

/**
 * Reveal order — a seeded permutation of every serial in the supply.
 *
 * This exists because rarity is positional (tiers.ts/tierForId): #0000–#0149
 * are X-RATED. Handing serials out in ascending order would therefore mean the
 * first 150 mints take every X-RATED in existence and every mint after #2000 is
 * uncommon forever — the mint would stop being a lottery and become a queue
 * position. Drawing the next serial from a shuffle restores the lottery while
 * keeping the low numbers genuinely rare.
 *
 * Seeded and cached, so the same permutation regenerates on every machine with
 * no database — the same property the rest of the collection relies on.
 */
let order: number[] | null = null

export function mintOrder(): readonly number[] {
  if (order) return order
  const rng = rngFrom('mintorder')
  const a = Array.from({ length: MAX_SUPPLY }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  order = a
  return order
}

/** The serial the Nth mint receives. */
export function serialForMint(position: number): number {
  const o = mintOrder()
  return o[((position % MAX_SUPPLY) + MAX_SUPPLY) % MAX_SUPPLY]
}

let cache: Xployee[] | null = null

/** The hired collection, in reveal order. Built once per session. */
export function collection(): Xployee[] {
  if (cache) return cache
  cache = mintOrder()
    .slice(0, HIRED_COUNT)
    .map((id, position) => buildXployee(id, hireTimeFor(position)))
  return cache
}

// Serials are no longer contiguous, so array indexing would silently return the
// wrong xployee. A map keyed on the real serial is the only correct lookup.
let index: Map<number, Xployee> | null = null

export function byId(id: number): Xployee | undefined {
  if (!index) index = new Map(collection().map((x) => [x.id, x]))
  return index.get(id)
}

/** Newest hires first. */
export function recentHires(count: number): Xployee[] {
  return [...collection()].sort((a, b) => b.hiredAt - a.hiredAt).slice(0, count)
}

export function tierCounts(): Record<TierId, number> {
  const counts = { entry: 0, mid: 0, expert: 0, xrated: 0 } as Record<TierId, number>
  for (const x of collection()) counts[x.tier.id]++
  return counts
}

/** Aggregate principal deployed across every desk, by ticker. */
export function deskExposure(): { ticker: string; principal: number; workers: number }[] {
  const map = new Map<string, { principal: number; workers: number }>()
  for (const x of collection()) {
    const share = x.principal / x.skills.length
    for (const held of x.skills) {
      const row = map.get(held.skill.ticker) ?? { principal: 0, workers: 0 }
      row.principal += share
      row.workers += 1
      map.set(held.skill.ticker, row)
    }
  }
  return [...map.entries()]
    .map(([ticker, v]) => ({ ticker, ...v }))
    .sort((a, b) => b.principal - a.principal)
}

export function totalPrincipal(): number {
  return collection().reduce((sum, x) => sum + x.principal, 0)
}

export const SUPPLY = { hired: HIRED_COUNT, max: MAX_SUPPLY }

export function currentEpoch(now: number): number {
  return epochAt(now)
}

/** Tier supply table, for the distribution bar. */
export function tierDistribution() {
  const counts = tierCounts()
  return TIERS.map((tier) => ({
    tier,
    count: counts[tier.id],
    share: counts[tier.id] / HIRED_COUNT,
  }))
}
