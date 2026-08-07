// The simulated collection. Deterministic, so 512 hired workers regenerate
// identically on every machine with no database behind them.
import { buildXployee, MAX_SUPPLY, type Xployee } from './xployee'
import { EPOCH_MS, GENESIS, epochAt } from './accrual'
import { rngFrom } from './rng'
import { TIERS, tierForId, type TierId } from './tiers'

/**
 * The genesis crew — what exists on the site before anyone mints.
 *
 * This was 512 xployees spread over 97 invented wallets, which was the right
 * shape for a demo and the wrong one for a launch: a brand-new protocol showing
 * a bustling secondary market is claiming a history it does not have.
 *
 * It is now one crew, held by the project wallet, sized so the landing page has
 * something to show and every rarity is represented. Real holders appear as they
 * mint.
 */
export const GENESIS_CREW: { tier: TierId; count: number }[] = [
  { tier: 'xrated', count: 2 },
  { tier: 'expert', count: 3 },
  { tier: 'mid', count: 10 },
  { tier: 'entry', count: 20 },
]

export const HIRED_COUNT = GENESIS_CREW.reduce((n, g) => n + g.count, 0)

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

/**
 * The serial the Nth mint receives, skipping anything the genesis crew holds.
 *
 * Without the skip the first minter would be issued a serial the project wallet
 * is already displaying, because the crew is drawn from this same permutation
 * but filtered by tier rather than taken off the front.
 */
export function serialForMint(position: number): number {
  const o = mintOrder()
  const taken = takenSerials()
  let seen = -1
  for (let i = 0; i < o.length; i++) {
    if (taken.has(o[i])) continue
    seen++
    if (seen === position) return o[i]
  }
  // Every serial is spoken for. Wrap rather than return undefined; a collection
  // this size will not reach it, and a wrong number beats a crash.
  return o[((position % MAX_SUPPLY) + MAX_SUPPLY) % MAX_SUPPLY]
}

let cache: Xployee[] | null = null

/**
 * The genesis crew, in reveal order.
 *
 * NOT simply the first HIRED_COUNT of the reveal order. That permutation is
 * uniform over the whole supply, so taking 35 from the front would follow the
 * natural distribution — about 1 X-RATED and 21 uncommons — and the landing page
 * would frequently show no X-RATED at all. GENESIS_CREW fixes the shape instead,
 * so every rarity is visible on a cold visit.
 *
 * Serials still come off the reveal permutation, in order, so these are drawn
 * from the same sequence a real mint draws from rather than being hand-picked.
 * Rarity is positional, so filtering by tier is just filtering by serial band.
 */
export function collection(): Xployee[] {
  if (cache) return cache

  const want = new Map<TierId, number>(GENESIS_CREW.map((g) => [g.tier, g.count]))
  const picked: number[] = []

  for (const serial of mintOrder()) {
    const tier = tierForId(serial, MAX_SUPPLY).id
    const left = want.get(tier) ?? 0
    if (left <= 0) continue
    want.set(tier, left - 1)
    picked.push(serial)
    if (picked.length === HIRED_COUNT) break
  }

  cache = picked.map((id, position) => buildXployee(id, hireTimeFor(position)))
  return cache
}

/**
 * Serials the genesis crew already holds.
 *
 * `serialForMint` walks the reveal order from a position, and the genesis crew
 * was drawn out of that same order — but NOT from its front, since it was
 * filtered by tier. So the next mint has to skip anything already taken, or the
 * first real minter is handed a serial the project wallet is already showing.
 */
let takenCache: Set<number> | null = null

export function takenSerials(): ReadonlySet<number> {
  if (!takenCache) takenCache = new Set(collection().map((x) => x.id))
  return takenCache
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
