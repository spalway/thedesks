// The xNET — a simulated ownership graph laid over the hired collection.
//
// Every one of the 512 xployees has to belong to someone. This file partitions
// them across 97 deterministic wallets with a realistic long tail: four whales,
// a broad middle, and a crowd holding one to three.
//
// The partition is built by slicing a seeded permutation of the collection's
// ids, so "every xployee owned exactly once" holds by construction rather than
// by convention — there is no code path that can drop or duplicate an id.
import { bookValue, yieldPerEpoch } from './accrual'
import { HIRED_COUNT, collection, byId } from './collection'
import { SKILLS } from './skills'
import { fakeAddress, pick, randInt, rngFrom, type Rng } from './rng'
import { tierRank, type TierId } from './tiers'

/** Status ladder, ascending. Derived from portfolio value, not headcount. */
export type XBoss = 'BOSS' | 'DIRECTOR' | 'VP' | 'CEO'

export const XBOSS_LADDER: readonly XBoss[] = ['BOSS', 'DIRECTOR', 'VP', 'CEO']

export interface NetworkWallet {
  address: string
  handle: string
  /** Ids into collection(), ascending. Disjoint across wallets, covering all. */
  xployeeIds: number[]
  holdings: number
  /** Sum of bookValue() across held xployees, USD. Moves with the clock. */
  portfolioValue: number
  yieldPerEpoch: number
  /** Value-weighted, so a whale's rate reflects where its capital actually is. */
  avgApy: number
  /** Rarest tier held. */
  bestTier: TierId
  xBoss: XBoss
}

// ---------------------------------------------------------------------------
// xBoss thresholds
// ---------------------------------------------------------------------------

/**
 * Absolute USD cutoffs, deliberately not percentile ranks: a rank should mean
 * "this much capital is deployed" and must not drop because somebody else
 * bought in. The only way down is selling.
 *
 * Derived by generating the network below and reading its real portfolioValue
 * distribution across all 97 wallets:
 *
 *   p10 ≈ $1.0K   p25 ≈ $2.0K   p50 ≈ $4.1K   p75 ≈ $8.1K
 *   p85 ≈ $18.2K  p90 ≈ $21.3K  p95 ≈ $26.4K  max ≈ $59.9K
 *
 * The nearest legible round numbers to the 96th / 84th / 56th percentiles give
 * almost exactly the intended shape:
 *
 *   CEO      >= $30,000    4.1%   (top ~4%)
 *   VP       >= $16,000   12.4%   (next ~12%)
 *   DIRECTOR >=  $5,000   27.8%   (next ~28%)
 *   BOSS      everything below   55.7%
 *
 * These hold as the clock runs. Book value is principal-dominated — principal
 * is a fixed $1K per skill and accrual is only a few percent of it — so the
 * whole distribution creeps up slowly and together rather than reshuffling.
 * That slow creep is the point: a wallet earns its way up a rung over time.
 *
 * Ordered high to low so xBossFor returns on the first match.
 */
export const XBOSS_THRESHOLDS: { rank: XBoss; minValue: number }[] = [
  { rank: 'CEO', minValue: 30_000 },
  { rank: 'VP', minValue: 16_000 },
  { rank: 'DIRECTOR', minValue: 5_000 },
  { rank: 'BOSS', minValue: 0 },
]

export function xBossFor(portfolioValue: number): XBoss {
  for (const step of XBOSS_THRESHOLDS) {
    if (portfolioValue >= step.minValue) return step.rank
  }
  return 'BOSS'
}

/** The rung above, and the USD still to earn or buy to reach it. Null at CEO. */
export function nextRank(portfolioValue: number): { rank: XBoss; remaining: number } | null {
  const current = XBOSS_LADDER.indexOf(xBossFor(portfolioValue))
  const next = XBOSS_LADDER[current + 1]
  if (!next) return null
  const step = XBOSS_THRESHOLDS.find((s) => s.rank === next)
  if (!step) return null
  return { rank: next, remaining: Math.max(0, step.minValue - portfolioValue) }
}

// ---------------------------------------------------------------------------
// Handles
// ---------------------------------------------------------------------------

// Back-office flavour on one side, crypto-native on the other. Crossing the two
// lists is what makes the network read as xNFTs rather than generic degens.
const STEMS = [
  'desk', 'ledger', 'vault', 'tape', 'margin', 'yield', 'basis', 'delta',
  'wick', 'candle', 'block', 'mint', 'carry', 'spread', 'tick', 'fill',
  'print', 'flow', 'book', 'wire', 'payroll', 'shift', 'badge', 'cubicle',
  'swivel', 'stapler', 'memo', 'quota', 'audit', 'coupon', 'float', 'pivot',
  'clerk', 'temp', 'nightshift', 'backoffice', 'lanyard', 'timesheet',
  'overtime', 'severance',
] as const

const TAGS = [
  'runner', 'pusher', 'holder', 'maxi', 'ape', 'whale', 'chad', 'sniper',
  'goblin', 'hands', 'printer', 'stacker', 'farmer', 'degen', 'dealer',
  'keeper', 'watcher', 'jockey', 'bot', 'lord', 'anon', 'wagie', 'bull',
  'bear', 'fund', 'capital', 'grinder', 'sweeper', 'flipper', 'baglord',
] as const

// The desks the collection actually works, so handles reference real tickers.
const TICKERS = SKILLS.map((s) => s.ticker.replace(/x$/, '').toLowerCase())

function rollHandle(rng: Rng): string {
  switch (randInt(rng, 0, 3)) {
    case 0:
      return `${pick(rng, STEMS)}${pick(rng, TAGS)}`
    case 1:
      return `${pick(rng, TICKERS)}_${pick(rng, TAGS)}`
    case 2:
      return `${pick(rng, TAGS)}_${pick(rng, STEMS)}`
    default:
      return `${pick(rng, STEMS)}${pick(rng, TAGS)}${randInt(rng, 2, 99)}`
  }
}

function uniqueHandle(rng: Rng, taken: Set<string>): string {
  for (let attempt = 0; attempt < 24; attempt++) {
    const handle = rollHandle(rng)
    if (!taken.has(handle)) {
      taken.add(handle)
      return handle
    }
  }
  // Never stall on an unlucky seed: suffix until free. Still deterministic,
  // because the roll order that got us here is.
  const base = rollHandle(rng)
  let n = 2
  while (taken.has(`${base}${n}`)) n++
  taken.add(`${base}${n}`)
  return `${base}${n}`
}

// ---------------------------------------------------------------------------
// Partition
// ---------------------------------------------------------------------------

/** Wallets holding 20–40. Few enough that the leaderboard has a real top. */
const WHALES = 4
/**
 * Wallets holding 9–16 — small funds. This band exists to keep the value curve
 * continuous: jumping straight from 8-xployee wallets to 20-xployee whales left
 * a hole between ~$16K and ~$46K, and any threshold landing in that hole would
 * have carved the network at a cliff instead of across a population.
 */
const DESKS = 16
/**
 * Supply reserved for the one-to-three-xployee crowd. A quarter of 512 at 1–3
 * each yields 67 small wallets — two thirds of the network, which is what makes
 * the tail look lived-in rather than decorative.
 */
const TAIL_SUPPLY = Math.round(HIRED_COUNT * 0.25)

/**
 * Holding counts that sum to exactly HIRED_COUNT.
 *
 * Every push clamps against what is left, so the total can never overshoot, and
 * the 1–3 tail loop guarantees it reaches zero.
 */
function walletSizes(rng: Rng): number[] {
  const sizes: number[] = []
  let remaining = HIRED_COUNT

  const take = (want: number) => {
    const size = Math.min(want, remaining)
    if (size <= 0) return
    sizes.push(size)
    remaining -= size
  }

  for (let i = 0; i < WHALES; i++) take(randInt(rng, 20, 40))
  for (let i = 0; i < DESKS; i++) take(randInt(rng, 9, 16))
  while (remaining > TAIL_SUPPLY) take(randInt(rng, 3, 8))
  while (remaining > 0) take(randInt(rng, 1, 3))

  return sizes
}

/** Fisher-Yates over the collection's real ids. */
function shuffledIds(rng: Rng): number[] {
  const ids = collection().map((x) => x.id)
  for (let i = ids.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    const tmp = ids[i]
    ids[i] = ids[j]
    ids[j] = tmp
  }
  return ids
}

/** The time-invariant half of a wallet: who it is and what it owns. */
interface WalletSkeleton {
  address: string
  handle: string
  xployeeIds: number[]
}

let skeletonCache: WalletSkeleton[] | null = null

function skeletons(): WalletSkeleton[] {
  if (skeletonCache) return skeletonCache

  const rng = rngFrom('xnet', 'wallets', 'v1')
  const ids = shuffledIds(rng)
  const sizes = walletSizes(rng)
  const taken = new Set<string>()
  const out: WalletSkeleton[] = []

  let cursor = 0
  for (let i = 0; i < sizes.length; i++) {
    // Disjoint slices of a permutation — this is the invariant, not a check.
    const owned = ids.slice(cursor, cursor + sizes[i]).sort((a, b) => a - b)
    cursor += sizes[i]
    out.push({
      address: fakeAddress(`xnet:wallet:${i}`),
      handle: uniqueHandle(rng, taken),
      xployeeIds: owned,
    })
  }

  // Belt and braces: fail loudly at boot rather than orphan an xployee quietly
  // if someone later edits walletSizes into something that under-allocates.
  if (cursor !== HIRED_COUNT) {
    throw new Error(`xnet: partitioned ${cursor} xployees, expected ${HIRED_COUNT}`)
  }

  skeletonCache = out
  return out
}

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

/**
 * Book values move continuously, so results are memoised per second rather than
 * per call — a network table re-rendering against a ticking clock would
 * otherwise re-price 512 xployees on every frame.
 */
const VALUE_BUCKET_MS = 1000

let valuedCache: { bucket: number; wallets: NetworkWallet[] } | null = null

/** Every wallet on the network, richest first. */
export function networkWallets(now: number): NetworkWallet[] {
  const bucket = Math.floor(now / VALUE_BUCKET_MS)
  if (valuedCache && valuedCache.bucket === bucket) return valuedCache.wallets

  const wallets = skeletons().map((s): NetworkWallet => {
    let portfolioValue = 0
    let epochYield = 0
    let apyByValue = 0
    let bestTier: TierId = 'entry'

    for (const id of s.xployeeIds) {
      // byId, not collection()[id]. Serials are drawn from the reveal order and
      // are scattered across the whole supply, so a serial is not an array
      // index — indexing by it returns undefined for almost every wallet.
      const x = byId(id)
      if (!x) continue
      const value = bookValue(x, now)
      portfolioValue += value
      epochYield += yieldPerEpoch(x)
      apyByValue += x.apy * value
      if (tierRank(x.tier.id) > tierRank(bestTier)) bestTier = x.tier.id
    }

    return {
      address: s.address,
      handle: s.handle,
      xployeeIds: s.xployeeIds,
      holdings: s.xployeeIds.length,
      portfolioValue,
      yieldPerEpoch: epochYield,
      avgApy: portfolioValue > 0 ? apyByValue / portfolioValue : 0,
      bestTier,
      xBoss: xBossFor(portfolioValue),
    }
  })

  wallets.sort((a, b) => b.portfolioValue - a.portfolioValue)
  valuedCache = { bucket, wallets }
  return wallets
}

export function topEarners(now: number, n: number): NetworkWallet[] {
  return [...networkWallets(now)]
    .sort((a, b) => b.yieldPerEpoch - a.yieldPerEpoch)
    .slice(0, Math.max(0, n))
}

/** Handle or address, case-insensitive. An empty query returns the full list. */
export function searchWallets(now: number, query: string): NetworkWallet[] {
  const q = query.trim().toLowerCase()
  const all = networkWallets(now)
  if (!q) return all
  return all.filter(
    (w) => w.handle.toLowerCase().includes(q) || w.address.toLowerCase().includes(q),
  )
}

export function walletByAddress(now: number, address: string): NetworkWallet | undefined {
  const target = address.trim()
  // Base58 is case-sensitive, so this one stays exact.
  return networkWallets(now).find((w) => w.address === target)
}

export function networkStats(now: number): {
  wallets: number
  totalValue: number
  totalYield: number
  medianHoldings: number
} {
  const all = networkWallets(now)
  const holdings = all.map((w) => w.holdings).sort((a, b) => a - b)
  const mid = Math.floor(holdings.length / 2)
  const medianHoldings =
    holdings.length === 0
      ? 0
      : holdings.length % 2 === 0
        ? (holdings[mid - 1] + holdings[mid]) / 2
        : holdings[mid]

  return {
    wallets: all.length,
    totalValue: all.reduce((sum, w) => sum + w.portfolioValue, 0),
    totalYield: all.reduce((sum, w) => sum + w.yieldPerEpoch, 0),
    medianHoldings,
  }
}
