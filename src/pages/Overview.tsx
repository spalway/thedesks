import { Link } from 'react-router-dom'
import { Panel, Stat, Bar, TierBadge, TierDot, LinkButton, Table, Th, Td, Tr, Money, Delta } from '../components/ui'
import { XployeeArt } from '../components/XployeeArt'
import { XBossBadge } from '../components/XBossBadge'
import { PixelLogo } from '../components/PixelLogo'
import { collection, showcase, tierDistribution, totalPrincipal, SUPPLY, deskExposure } from '../lib/collection'
import { accruedTotal, msUntilNextEpoch, epochAt } from '../lib/accrual'
import { floorPrice, saleListings, contractListings } from '../lib/market'
import { topEarners, networkStats } from '../lib/network'
import { useNow } from '../lib/useNow'
import { usePrices } from '../lib/usePrices'
import { usd, usdCompact, num, pct, duration, xnft, plural } from '../lib/format'
import { serial } from '../lib/xployee'
import { getStock } from '../lib/xstocks'

export function Overview() {
  const now = useNow(1000)
  const prices = usePrices()
  const all = collection()

  const lifetimeYield = all.reduce((sum, x) => sum + accruedTotal(x, now), 0)
  const nav = totalPrincipal() + lifetimeYield
  // Guarded: `all` is one xployee at launch and could in principle be none.
  // Dividing by an empty collection is how a headline stat becomes NaN.
  const avgApy = all.length > 0 ? all.reduce((sum, x) => sum + x.apy, 0) / all.length : 0
  const dist = tierDistribution()
  const desks = deskExposure().slice(0, 6)
  const leaders = topEarners(now, 5)
  const net = networkStats(now)
  const floor = floorPrice()
  const crew = showcase()
  // By id, not dist[3] — TIERS is ordered commonest-first today and an editor
  // reordering it would silently make this sentence quote the wrong number.
  const xratedSupply = dist.find((d) => d.tier.id === 'xrated')?.supply ?? 0
  const forSale = saleListings().length
  const forHire = contractListings().length

  return (
    <div className="space-y-5">
      {/* `right` as plain text, not a Chip: the panel bar is `bg-ink`, and every
          Chip tone is either `bg-ink` or `text-ink`, so a chip up here is the
          same colour as the bar it sits on and the feed's state reads as blank.
          The header styles its own meta slot at `text-paper/60`. */}
      <Panel
        title="Investor Center — Protocol Overview"
        right={prices.source === 'live' ? 'Live' : 'Cached'}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Hired" value={num(SUPPLY.hired)} sub={`of ${num(SUPPLY.max)} max`} />
          <Stat label="Protocol NAV" value={usdCompact(nav)} sub="principal + accrued" />
          <Stat label="Yield Accrued" value={usdCompact(lifetimeYield)} sub="lifetime, all xployees" />
          <Stat label="Avg APY" value={pct(avgApy)} sub="blended across desks" />
          {/* An em dash, not xnft(0). A floor of "0 xNFT" reads as a price —
              and the cheapest one on the board — when what is true is that
              there is no board yet. */}
          <Stat
            label="Floor"
            value={
              floor > 0 ? <span className="keep-case">{xnft(floor)}</span> : <span>—</span>
            }
            sub={floor > 0 ? 'lowest ask' : 'no listings yet'}
          />
          <Stat
            label="Next Settlement"
            value={<span className="tabular-nums">{duration(msUntilNextEpoch(now))}</span>}
            sub={`epoch ${epochAt(now)}`}
          />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Not "Recent Hires". Nothing has been hired — there is one worker on
            the books and a list of one reads as an outage. What a launch-day
            visitor actually wants is to see the art, so this shows unminted
            workers across every rarity and says plainly that nobody owns them.
            They are real serials off the reveal order, so any of them can still
            be drawn. */}
        <Panel title="The Workforce" right="unminted · sample">
          <div className="flex flex-wrap gap-4">
            {crew.map((x) => (
              <Link key={x.id} to={`/xployee/${x.id}`} className="group block w-[96px]">
                <XployeeArt xployee={x} size={96} className="" />
                <div className="mt-2 flex items-center gap-1.5">
                  <TierDot tier={x.tier} />
                  <span className="ui ui-10 group-hover:underline">{serial(x.id)}</span>
                </div>
                <div className="text-[10px] leading-tight text-ink-faint">
                  {x.skills.length} skill{x.skills.length > 1 ? 's' : ''} · {pct(x.apy, 1)}
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 text-[10px] leading-relaxed text-ink-faint">
            Every xployee is generated from its serial, so these are exactly what those numbers
            look like — none of them has been minted, and any of them can still be drawn.{' '}
            <Link to="/mint" className="underline">
              Hire one →
            </Link>
          </div>
        </Panel>

        {/* Was "Workforce Composition", reporting the mix of what had been
            minted. At a supply of one that says 100% X-RATED, which is true and
            useless. Before anything is minted the number that means something
            is the plan: how many of each rarity will ever exist, and which
            serials they are. */}
        <Panel title="Rarity Supply" right={`${num(SUPPLY.max)} max`}>
          <Bar
            segments={dist.map((d) => ({ value: d.supply, color: d.tier.color, label: d.tier.label }))}
          />
          <div className="mt-4 space-y-2.5">
            {dist.map((d) => (
              <div key={d.tier.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <TierDot tier={d.tier} />
                  <TierBadge tier={d.tier} />
                  <span className="text-[10px] text-ink-faint">
                    {d.tier.skills} skill{d.tier.skills > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-[10px] tabular-nums">
                  {num(d.supply)} <span className="text-ink-faint">/ {pct(d.share, 1)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-rule pt-4 text-[10px] leading-relaxed text-ink-mute">
            Rarity is skill count, and it is positional — a serial is itself a rarity claim. An
            X-RATED xployee works four desks at once, and only {num(xratedSupply)} of them will
            ever exist.
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Busiest Desks" right="by capital">
          <Table>
            <thead>
              <tr>
                <Th>Desk</Th>
                <Th>Ticker</Th>
                <Th align="right">Price</Th>
                <Th align="right">24h</Th>
                <Th align="right">Deployed</Th>
              </tr>
            </thead>
            <tbody>
              {desks.map((d, i) => {
                const stock = getStock(d.ticker)
                return (
                  <Tr key={d.ticker} index={i}>
                    <Td>{stock.sector}</Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <PixelLogo symbol={d.ticker} size={16} />
                        <span className="mono keep-case font-medium">${d.ticker}</span>
                      </span>
                    </Td>
                    <Td align="right">{usd(prices.bySymbol[d.ticker])}</Td>
                    <Td align="right"><Delta value={prices.change24h[d.ticker]} /></Td>
                    <Td align="right"><Money>{usdCompact(d.principal)}</Money></Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
          <div className="mt-3 text-[10px] text-ink-faint">
            Prices and mint addresses are real xStocks data. Deployed capital is simulated.
          </div>
        </Panel>

        <Panel title="xNET — Top Earners" right={plural(net.wallets, 'wallet')}>
          <Table>
            <thead>
              <tr>
                <Th align="right">#</Th>
                <Th>Handle</Th>
                <Th>xBoss</Th>
                <Th align="right">Crew</Th>
                <Th align="right">Per Epoch</Th>
                <Th align="right">Portfolio</Th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((w, i) => (
                <Tr key={w.address} index={i}>
                  <Td align="right" className="text-ink-faint">
                    {i + 1}
                  </Td>
                  <Td>
                    <Link to={`/wallet/${w.address}`} className="mono font-medium hover:underline">
                      {w.handle}
                    </Link>
                  </Td>
                  <Td>
                    <XBossBadge rank={w.xBoss} />
                  </Td>
                  <Td align="right">{num(w.holdings)}</Td>
                  <Td align="right">{usd(w.yieldPerEpoch, 2)}</Td>
                  <Td align="right"><Money>{usdCompact(w.portfolioValue)}</Money></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 flex items-center gap-3">
            <LinkButton to="/xnet">Open xNET →</LinkButton>
            <span className="text-[10px] text-ink-faint">
              {forSale === 0 && forHire === 0
                ? 'Nothing listed yet'
                : `${num(forSale)} for sale · ${num(forHire)} for hire`}
            </span>
          </div>
        </Panel>
      </div>

      <Panel title="How This Works">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              n: '1 · Hire',
              body:
                'Mint an xployee. Its tier decides how many skills it has, and each skill opens a desk tied to a real tokenized equity on Solana. Uncommon works one desk; X-RATED works four.',
              link: { to: '/mint', label: 'Hire →' },
            },
            {
              n: '2 · They Work',
              body:
                'Every desk pays into the xployee’s book each epoch. Accrual is per-NFT, not per-claim — skip a claim and you keep the credit. It compounds until you take it.',
              link: { to: '/marketplace', label: 'Browse workforce →' },
            },
            {
              n: '3 · Claim, Contract, Or Sell',
              body:
                'Claim yield to your wallet, contract the xployee out for a fixed fee and let someone else take the output, or sell it outright — the book goes with it.',
              link: { to: '/marketplace', label: 'Marketplace →' },
            },
          ].map((c) => (
            <div key={c.n}>
              <div className="ui ui-10 text-ink-mute">{c.n}</div>
              <p className="mt-2.5 text-[11px] leading-relaxed">{c.body}</p>
              {/* inline-flex + min-h-11 rather than the inline-block this used
                  to be: at 15px tall it was a third of the 44px touch target and
                  the hardest thing on the page to hit on a phone. The margin
                  drops to mt-1 so the extra height comes out of the gap that was
                  already there instead of adding a row to the card. */}
              <Link
                to={c.link.to}
                className="ui ui-10 mt-1 inline-flex min-h-11 items-center underline"
              >
                {c.link.label}
              </Link>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
