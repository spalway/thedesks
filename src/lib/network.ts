// The xNET — who owns what.
//
// At launch this is one wallet: the project wallet, holding the genesis crew.
// It used to invent 97 holders with generated handles and `fakeAddress`
// addresses, which suited a demo and would misrepresent a launch — none of those
// addresses existed, and a first-day protocol showing a hundred holders is
// claiming a history it does not have.
//
// Real wallets appear here as people mint. The valuation and xBoss machinery
// below is unchanged and applies to whoever shows up.
import { bookValue, yieldPerEpoch } from './accrual'
import { collection, byId } from './collection'
import { devWalletAddress } from './spl'
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


/** The time-invariant half of a wallet: who it is and what it owns. */
interface WalletSkeleton {
  address: string
  handle: string
  xployeeIds: number[]
}

/**
 * The network at launch: one wallet, holding the whole genesis crew.
 *
 * This used to partition 512 xployees across 97 invented wallets with invented
 * handles. That was right for a demo and wrong for a launch — a protocol on its
 * first day showing a hundred holders and a busy secondary market is inventing a
 * history it does not have, and every one of those addresses was a `fakeAddress`
 * nobody could look up.
 *
 * So xNET starts honest: the project wallet, the crew it holds, and nothing
 * else. It fills up as people actually mint.
 *
 * Not cached across config changes, unlike the old version — the address comes
 * from runtime config, and an operator who corrects the project wallet in
 * Supabase must see xNET follow rather than keep showing the old one.
 */
function skeletons(): WalletSkeleton[] {
  const ids = collection()
    .map((x) => x.id)
    .sort((a, b) => a - b)

  // Before the project wallet is configured there is no honest address to show.
  // A placeholder is better than a fake one that looks real enough to search for.
  const address = devWalletAddress() || 'PROJECT-WALLET-NOT-CONFIGURED'

  return [{ address, handle: 'xNFTs', xployeeIds: ids }]
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
