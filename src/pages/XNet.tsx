import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, Stat, Table, Th, Td, Tr, Empty, Button, Chip, Money, TierBadge } from '../components/ui'
import { XployeeArt } from '../components/XployeeArt'
import { XBossBadge } from '../components/XBossBadge'
import { networkStats, searchWallets, topEarners, type NetworkWallet } from '../lib/network'
import { getTier } from '../lib/tiers'
import { byId } from '../lib/collection'
import { useNow } from '../lib/useNow'
import { num, pct, usd, usdCompact, shortAddress } from '../lib/format'

type Sort = 'value' | 'yield' | 'holdings'
const PAGE = 30

export function XNet() {
  const now = useNow(5000)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('value')
  const [limit, setLimit] = useState(PAGE)

  const stats = networkStats(now)
  const leaders = topEarners(now, 3)

  const results = useMemo(() => {
    const found = searchWallets(now, query)
    const sorted = [...found]
    if (sort === 'value') sorted.sort((a, b) => b.portfolioValue - a.portfolioValue)
    else if (sort === 'yield') sorted.sort((a, b) => b.yieldPerEpoch - a.yieldPerEpoch)
    else sorted.sort((a, b) => b.holdings - a.holdings)
    return sorted
  }, [now, query, sort])

  const visible = results.slice(0, limit)

  return (
    <div className="space-y-5">
      <Panel title="xNET — The Network" right={`${num(stats.wallets)} wallets`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Wallets" value={num(stats.wallets)} sub="holding xployees" />
          <Stat label="Network Value" value={usdCompact(stats.totalValue)} sub="all books combined" />
          <Stat label="Network Yield" value={usd(stats.totalYield, 2)} sub="per epoch" />
          <Stat label="Median Holdings" value={num(stats.medianHoldings, 1)} sub="xployees per wallet" />
        </div>
        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
          Every xployee in circulation is held by exactly one wallet. xBoss rank is set by the total value
          of the crew a wallet controls — capital deployed, not headcount — so it only moves when you buy
          or sell.
        </p>
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        {leaders.map((w, i) => (
          <LeaderCard key={w.address} wallet={w} rank={i + 1} />
        ))}
      </div>

      <Panel title="Wallet Directory" right={`${num(results.length)} matching`}>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex flex-1 items-center gap-2 min-w-[240px]">
            <span className="ui ui-10 text-ink-mute">Search</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(PAGE)
              }}
              placeholder="handle or wallet address"
              className="min-h-11 w-full border border-ink bg-paper px-3 py-2 text-[11px] outline-none placeholder:text-ink-faint focus:bg-wash"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="ui ui-10 text-ink-mute">Sort</span>
            <select
              className="ui ui-10 min-h-11 border border-ink bg-paper px-2.5 py-2"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
            >
              <option value="value">Portfolio value</option>
              <option value="yield">Yield per epoch</option>
              <option value="holdings">Crew size</option>
            </select>
          </label>
          {query ? (
            <Button variant="outline" onClick={() => setQuery('')}>
              Clear
            </Button>
          ) : null}
        </div>
      </Panel>

      {visible.length === 0 ? (
        <Empty title="No wallets match">Try a different handle or paste a full address.</Empty>
      ) : (
        <Panel title="Wallets" right={`${num(visible.length)} of ${num(results.length)}`} bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th align="right">#</Th>
                <Th>Handle</Th>
                <Th>Address</Th>
                <Th>xBoss</Th>
                <Th>Best Pull</Th>
                <Th align="right">Crew</Th>
                <Th align="right">Avg APY</Th>
                <Th align="right">Per Epoch</Th>
                <Th align="right">Portfolio</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w, i) => (
                <Tr key={w.address} index={i}>
                  <Td align="right" className="text-ink-faint">
                    {i + 1}
                  </Td>
                  <Td>
                    <Link to={`/wallet/${w.address}`} className="mono font-medium hover:underline">
                      {w.handle}
                    </Link>
                  </Td>
                  <Td className="text-ink-faint" title={w.address}>
                    {shortAddress(w.address)}
                  </Td>
                  <Td>
                    <XBossBadge rank={w.xBoss} />
                  </Td>
                  {/* TierBadge, not a hand-rolled span on tier.color. The raw
                      hues are the decorative value and measured 2.78:1
                      (UNCOMMON) to 3.88:1 (RARE) as type here; the badge carries
                      the accessible ladder and the tier effects with it. */}
                  <Td>
                    <TierBadge tier={getTier(w.bestTier)} />
                  </Td>
                  <Td align="right">{num(w.holdings)}</Td>
                  <Td align="right">{pct(w.avgApy, 1)}</Td>
                  <Td align="right">{usd(w.yieldPerEpoch, 2)}</Td>
                  <Td align="right"><Money>{usdCompact(w.portfolioValue)}</Money></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      {limit < results.length ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Load more ({num(results.length - limit)} left)
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function LeaderCard({ wallet, rank }: { wallet: NetworkWallet; rank: number }) {
  // Show the crew's rarest member as the wallet's face.
  const best = wallet.xployeeIds.map((id) => byId(id)).filter(Boolean)
  const face = best.sort((a, b) => (b?.tier.skills ?? 0) - (a?.tier.skills ?? 0))[0]

  return (
    <Panel title={`#${rank} Top Earner`} right={<span className="keep-case">{wallet.handle}</span>}>
      <div className="flex gap-4">
        {face ? <XployeeArt xployee={face} size={96} className="shrink-0" /> : null}
        <div className="min-w-0 flex-1 space-y-2">
          <XBossBadge rank={wallet.xBoss} size="lg" />
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="mute">{num(wallet.holdings)} xployees</Chip>
            <Chip tone="mute">{pct(wallet.avgApy, 1)} APY</Chip>
          </div>
          <div className="space-y-1 border-t border-rule pt-2 text-[10px]">
            <div className="flex justify-between">
              <span className="text-ink-faint">Per epoch</span>
              <span className="tabular-nums">{usd(wallet.yieldPerEpoch, 2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-faint">Portfolio</span>
              <span className="tabular-nums">{usdCompact(wallet.portfolioValue)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Link
          to={`/wallet/${wallet.address}`}
          className="ui ui-10 inline-flex min-h-11 items-center border border-ink px-3 py-2 hover:bg-ink hover:text-paper"
        >
          View crew →
        </Link>
      </div>
    </Panel>
  )
}
