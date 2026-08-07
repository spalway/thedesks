import { Link, useParams } from 'react-router-dom'
import { Panel, TierBadge, Table, Th, Td, Tr, Stat, Chip, LinkButton, cardTone, SerialTag } from '../components/ui'
import { XployeeArt } from '../components/XployeeArt'
import { backgroundFor } from '../lib/backgrounds'
import { byId } from '../lib/collection'
import { listingFor, contractMath, saleMath, XNFT_USD } from '../lib/market'
import { SIM_RENT_FEE_BPS, SIM_SALE_FEE_BPS, bpsFraction } from '../lib/fees'
import { accruedBySkill, accruedTotal, bookValue, trailingApy, yieldPerEpoch } from '../lib/accrual'
import { effectiveApy } from '../lib/skills'
import { useNow } from '../lib/useNow'
import { usePrices } from '../lib/usePrices'
import { serial } from '../lib/xployee'
import { getStock } from '../lib/xstocks'
import { usd, usdLive, pct, num, shortAddress, dateOnly, xnft, signedPct } from '../lib/format'
import { NotFound } from './NotFound'
import { useHoldings } from '../lib/useHoldings'

export function XployeeSheet() {
  const { id } = useParams()
  const now = useNow(1000)
  const prices = usePrices()
  const holdings = useHoldings()

  const numericId = Number(id)
  const fromCollection = Number.isFinite(numericId) ? byId(numericId) : undefined
  const fromHoldings = holdings.xployees.find((x) => x.id === numericId)
  const x = fromCollection ?? fromHoldings

  if (!x) return <NotFound label="No such xployee" />

  const listing = listingFor(x.id)
  const accrual = accruedBySkill(x, now)
  const trailing = trailingApy(x, now)
  const owned = Boolean(fromHoldings)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[11px] text-ink-mute">
        {/* The breadcrumb is the only way back on a phone, and at 18px tall it
            was the smallest target on the sheet. min-h-11 makes the crumb row
            44px rather than leaving the link to the height of its own text. */}
        <Link to="/marketplace" className="inline-flex min-h-11 items-center underline">
          Marketplace
        </Link>
        <span>/</span>
        <span className="ui ui-10 text-ink">{serial(x.id)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="min-w-0 space-y-4">
          {/* Every panel on this page carries the xployee's rarity, so the
              whole sheet reads as one unit rather than a neutral shell with a
              coloured badge dropped into it. tier.shade, not tier.color — see
              Panel's accent prop for why white needs the deeper value. */}
          <Panel
            title="xployee"
            accent={x.tier.shade}
            right={owned ? 'Yours' : undefined}
            bodyClassName={`p-0 ${cardTone(x.tier.id)}`}
          >
            <XployeeArt xployee={x} size={288} fill framed={false} bottomRule />
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between">
                <SerialTag tier={x.tier} className="ui-14">{serial(x.id)}</SerialTag>
                <TierBadge tier={x.tier} size="lg" />
              </div>
              <div className="space-y-1 border-t border-rule pt-2 text-[11px]">
                <Row label="Mint" value={<span title={x.mint}>{shortAddress(x.mint, 6, 6)}</span>} />
                <Row label="Hired" value={dateOnly(x.hiredAt)} />
                <Row label="Desks worked" value={num(x.skills.length)} />
                <Row label="Principal" value={usd(x.principal, 0)} />
              </div>
            </div>
          </Panel>

          <Panel title="Appearance" accent={x.tier.shade}>
            <div className="space-y-1 text-[11px]">
              <Row label="Uniform" value={x.traits.uniform} />
              <Row label="Head" value={x.traits.head} />
              <Row label="Face" value={x.traits.face} />
              <Row label="Accessory" value={x.traits.accessory} />
              <Row label="Backdrop" value={backgroundFor(x).name} />
            </div>
          </Panel>
        </div>

        {/* min-w-0: this column holds the eight-column Skills table, and a grid
            item's automatic minimum is its min-content width — without this the
            track refuses to go below the table's natural width and the sheet
            scrolls the whole page sideways on a phone instead of scrolling the
            table inside its own box. */}
        <div className="min-w-0 space-y-4">
          <Panel title="Book" accent={x.tier.shade}>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat label="Book Value" value={usd(bookValue(x, now))} sub="principal + accrued" />
              <Stat
                label="Accrued"
                value={<span className="tabular-nums">{usdLive(accruedTotal(x, now))}</span>}
                sub="unclaimed, ticking"
              />
              <Stat
                label="Trailing APY"
                value={
                  <span className="flex items-baseline gap-1.5">
                    {pct(trailing.rate)}
                    {trailing.estimated ? <Chip tone="outline">Est</Chip> : null}
                  </span>
                }
                sub="30-epoch window"
              />
              <Stat label="Per Epoch" value={usd(yieldPerEpoch(x), 3)} sub="at current rate" />
            </div>
          </Panel>

          <Panel title="Skills — Desks Worked" accent={x.tier.shade} right={`${x.skills.length} of 4`}>
            <Table>
              <thead>
                <tr>
                  <Th>Skill</Th>
                  <Th>Desk</Th>
                  <Th>Ticker</Th>
                  <Th align="right">Price</Th>
                  <Th align="right">24h</Th>
                  <Th align="right">Prof.</Th>
                  <Th align="right">Eff. APY</Th>
                  <Th align="right">Accrued</Th>
                </tr>
              </thead>
              <tbody>
                {accrual.map((row, i) => {
                  const stock = getStock(row.held.skill.ticker)
                  const change = prices.change24h[stock.symbol]
                  return (
                    <Tr key={row.held.skill.id} index={i}>
                      <Td>
                        <span className="ui ui-10">{row.held.skill.label}</span>
                      </Td>
                      <Td className="text-ink-mute">{row.held.skill.desk}</Td>
                      <Td>${stock.symbol}</Td>
                      <Td align="right">{usd(prices.bySymbol[stock.symbol])}</Td>
                      <Td align="right" className="text-[11px] text-ink-mute">
                        {change === undefined ? '—' : signedPct(change)}
                      </Td>
                      <Td align="right">{pct(row.held.proficiency, 0)}</Td>
                      <Td align="right">{pct(effectiveApy(row.held))}</Td>
                      <Td align="right" className="tabular-nums">
                        {usdLive(row.usd)}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              Blended APY is the mean of effective skill rates, so more desks means more diversification
              rather than a flat multiple. Scarce high-rate skills are what lift the average.
            </p>
          </Panel>

          {listing ? (
            <Panel
              accent={x.tier.shade}
              title={listing.kind === 'sale' ? 'Listed For Sale' : 'Listed For Contract'}
            >
              {listing.kind === 'sale' ? (
                (() => {
                  const q = saleMath(listing)
                  return (
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <div className="ui ui-10 text-ink-mute">Total to buy</div>
                        <div className="ui ui-18 keep-case mt-1">{xnft(q.totalXnft)}</div>
                        {/* The ask alone is not what leaves the wallet. Both legs
                            are spelled out so the total is never a surprise. */}
                        <div className="mt-1 text-[11px] text-ink-faint">
                          {xnft(q.askXnft)} to the seller + {xnft(q.feeXnft)} marketplace fee (
                          {pct(bpsFraction(SIM_SALE_FEE_BPS), 0)})
                        </div>
                        <div className="mt-1 text-[11px] text-ink-faint">
                          ≈ {usd(q.totalXnft * XNFT_USD)} at {usd(XNFT_USD, 2)}/xNFT
                        </div>
                      </div>
                      <LinkButton to="/marketplace">View in marketplace →</LinkButton>
                    </div>
                  )
                })()
              ) : (
                (() => {
                  const m = contractMath(listing)
                  return (
                    <div className="grid gap-2 md:grid-cols-5">
                      <Stat
                        label="Fee / Epoch"
                        value={<span className="keep-case">{xnft(listing.feePerEpoch)}</span>}
                        sub={`${listing.term} epochs`}
                      />
                      <Stat
                        label="Gross"
                        value={<span className="keep-case">{xnft(m.grossXnft)}</span>}
                        sub="to the owner"
                      />
                      <Stat
                        label="Marketplace Fee"
                        value={<span className="keep-case">{xnft(m.feeXnft)}</span>}
                        sub={pct(bpsFraction(SIM_RENT_FEE_BPS), 0)}
                      />
                      <Stat
                        label="Total Cost"
                        value={<span className="keep-case">{xnft(m.costXnft)}</span>}
                        sub="paid up front"
                      />
                      <Stat
                        label="Renter Margin"
                        value={
                          <span className="keep-case">
                            {m.marginXnft >= 0 ? '▲' : '▼'} {xnft(Math.abs(m.marginXnft))}
                          </span>
                        }
                        sub={`${pct(m.marginPct, 1)} vs cost`}
                      />
                    </div>
                  )
                })()
              )}
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-faint">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}
