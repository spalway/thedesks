import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, TierBadge, Table, Th, Td, Tr, Stat, Button, Chip, Empty, cardTone, SerialTag } from '../components/ui'
import { XployeeArt } from '../components/XployeeArt'
import {
  saleListings,
  contractListings,
  contractMath,
  saleMath,
  floorPrice,
  listingFor,
  XNFT_USD,
  type ContractListing,
} from '../lib/market'
import { SIM_RENT_FEE_BPS, SIM_SALE_FEE_BPS, bpsFraction } from '../lib/fees'
import { collection } from '../lib/collection'
import { TIERS, type TierId } from '../lib/tiers'
import { SKILLS } from '../lib/skills'
import { serial } from '../lib/xployee'
import { bookValue } from '../lib/accrual'
import { useNow } from '../lib/useNow'
import { num, pct, usd, xnft, usdCompact } from '../lib/format'

type Mode = 'browse' | 'sale' | 'contract'
type Sort = 'id' | 'apy' | 'tier' | 'book'

const PAGE = 36

/* min-h-11 on every control in the filter bar: the selects rendered at 33px and
   the mode buttons at 39px, both under the 44px touch target, and this bar is the
   only way to navigate the workforce on a phone. */
const SELECT = 'ui ui-10 min-h-11 border border-ink bg-paper px-2.5 py-2 text-ink'

/**
 * Rendered fee rates, read off the constants so a repricing updates the copy too.
 * Both price the simulated marketplace only — minting takes no fee at all.
 */
const TRADE_FEE_LABEL = pct(bpsFraction(SIM_SALE_FEE_BPS), 0)
const RENT_FEE_LABEL = pct(bpsFraction(SIM_RENT_FEE_BPS), 0)

export function Marketplace() {
  const now = useNow(5000)
  const [mode, setMode] = useState<Mode>('browse')
  const [tier, setTier] = useState<TierId | 'all'>('all')
  const [skill, setSkill] = useState('all')
  const [sort, setSort] = useState<Sort>('id')
  const [limit, setLimit] = useState(PAGE)

  const browse = useMemo(() => {
    let list = collection()
    if (tier !== 'all') list = list.filter((x) => x.tier.id === tier)
    if (skill !== 'all') list = list.filter((x) => x.skills.some((h) => h.skill.id === skill))

    const sorted = [...list]
    if (sort === 'apy') sorted.sort((a, b) => b.apy - a.apy)
    else if (sort === 'tier') sorted.sort((a, b) => b.tier.skills - a.tier.skills || a.id - b.id)
    else if (sort === 'book') sorted.sort((a, b) => bookValue(b, now) - bookValue(a, now))
    return sorted
  }, [tier, skill, sort, now])

  const sales = useMemo(() => {
    const list = tier === 'all' ? saleListings() : saleListings().filter((l) => l.xployee.tier.id === tier)
    return [...list].sort((a, b) => a.price - b.price)
  }, [tier])

  const contracts = useMemo(() => {
    const list =
      tier === 'all' ? contractListings() : contractListings().filter((l) => l.xployee.tier.id === tier)
    return [...list].sort((a, b) => contractMath(b).marginPct - contractMath(a).marginPct)
  }, [tier])

  const visible = browse.slice(0, limit)

  return (
    <div className="space-y-5">
      <Panel
        title="Marketplace"
        right={`${num(saleListings().length + contractListings().length)} open listings`}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Workforce" value={num(collection().length)} sub="xployees in circulation" />
          <Stat
            label="Floor"
            value={<span className="keep-case">{xnft(floorPrice())}</span>}
            sub="lowest ask, before fee"
          />
          <Stat label="For Sale" value={num(saleListings().length)} sub="ownership transfers" />
          <Stat label="For Contract" value={num(contractListings().length)} sub="yield rentals" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <div className="flex">
            {(
              [
                ['browse', 'Browse'],
                ['sale', 'Buy · Sell'],
                ['contract', 'Contract'],
              ] as const
            ).map(([key, label], i) => (
              <button
                key={key}
                onClick={() => {
                  setMode(key)
                  setLimit(PAGE)
                }}
                className={`ui ui-11 min-h-11 border border-ink px-4 py-2.5 ${i > 0 ? 'border-l-0' : ''} ${
                  mode === key ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-wash'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2">
            <span className="ui ui-10 text-ink-mute">Tier</span>
            <select
              className={SELECT}
              value={tier}
              onChange={(e) => {
                setTier(e.target.value as TierId | 'all')
                setLimit(PAGE)
              }}
            >
              <option value="all">All tiers</option>
              {TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.skills})
                </option>
              ))}
            </select>
          </label>

          {mode === 'browse' ? (
            <>
              <label className="flex items-center gap-2">
                <span className="ui ui-10 text-ink-mute">Skill</span>
                <select
                  className={SELECT}
                  value={skill}
                  onChange={(e) => {
                    setSkill(e.target.value)
                    setLimit(PAGE)
                  }}
                >
                  <option value="all">Any skill</option>
                  {SKILLS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="ui ui-10 text-ink-mute">Sort</span>
                <select className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="id">Serial</option>
                  <option value="apy">Highest APY</option>
                  <option value="tier">Rarest first</option>
                  <option value="book">Largest book</option>
                </select>
              </label>
            </>
          ) : null}
        </div>

        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
          {mode === 'browse' ? (
            <>
              Every xployee in circulation. Rarity is skill count — an X-RATED works four desks at once,
              and three percent of the workforce does.
            </>
          ) : mode === 'sale' ? (
            <>
              Buying an xployee transfers the worker <em>and</em> its book — accrued yield included. The
              seller receives the ask; the {TRADE_FEE_LABEL} marketplace fee rides on top, and the total is
              the figure to judge a listing by. Total-to-book is the number that matters: under 1.00× you
              are paying less than the book is already worth.{' '}
              <strong>Sales are simulated.</strong> Swapping a worker for $xNFT atomically needs an escrow
              or both parties co-signing one transaction, and neither exists here — so a sale is a ledger
              entry, and nothing leaves your wallet. The three numbers below are what a real trade would
              cost, not a charge you are about to incur.
            </>
          ) : (
            <>
              A contract rents an xployee's output. The renter pays up front and takes every dollar the
              worker produces for the term; the owner keeps the asset and swaps variable yield for
              guaranteed income. The owner receives the gross; the renter also pays a{' '}
              {RENT_FEE_LABEL} marketplace fee, and margin is projected output minus that full cost — so
              break-even sits at a listing spread of 0.909×, not 1.00×. Unlike a sale this settles for
              real: the xployee never moves, so the whole rental is one transaction the renter signs,
              paying owner and treasury together. Nothing on this board builds one — it quotes.
            </>
          )}
        </p>
      </Panel>

      {mode === 'browse' ? (
        visible.length === 0 ? (
          <Empty title="No xployees match">Loosen a filter to see more of the workforce.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              {visible.map((x) => {
                const listing = listingFor(x.id)
                return (
                  <Link
                    key={x.id}
                    to={`/xployee/${x.id}`}
                    className={`group border border-ink bg-paper transition-colors ${
                      cardTone(x.tier.id) || 'hover:bg-wash'
                    }`}
                  >
                    <XployeeArt xployee={x} size={192} fill animated={false} framed={false} bottomRule />
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <SerialTag tier={x.tier} className="group-hover:underline">
                          {serial(x.id)}
                        </SerialTag>
                        {listing ? (
                          <Chip tone="mute">{listing.kind === 'sale' ? 'Sale' : 'Hire'}</Chip>
                        ) : null}
                      </div>
                      <TierBadge tier={x.tier} />
                      <div className="text-[10px] leading-tight text-ink-mute">
                        {x.skills.map((h) => h.skill.label).join(' · ')}
                      </div>
                      <div className="flex items-center justify-between border-t border-rule pt-2 text-[10px]">
                        <span className="text-ink-faint">Book</span>
                        <span className="tabular-nums">{usdCompact(bookValue(x, now))}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-ink-faint">APY</span>
                        <span className="tabular-nums">{pct(x.apy, 1)}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
            {limit < browse.length ? (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
                  Load more ({num(browse.length - limit)} left)
                </Button>
              </div>
            ) : null}
          </>
        )
      ) : mode === 'sale' ? (
        sales.length === 0 ? (
          <Empty title="No sale listings">Nothing at this tier is currently for sale.</Empty>
        ) : (
          <Panel
            title="Sale Listings"
            right={`Simulated · ${num(sales.length)} shown`}
            bodyClassName="p-0"
          >
            <Table>
              <thead>
                <tr>
                  <Th>xployee</Th>
                  <Th>Tier</Th>
                  <Th>Skills</Th>
                  <Th align="right">APY</Th>
                  <Th align="right">Book</Th>
                  <Th align="right">Ask</Th>
                  <Th align="right">Fee {TRADE_FEE_LABEL}</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Total / Book</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody>
                {sales.map((l, i) => {
                  const book = bookValue(l.xployee, now)
                  const q = saleMath(l)
                  // Against the total, not the ask: the ratio is meant to answer
                  // "am I paying less than this book is worth", and the fee is
                  // part of what you pay.
                  const ratio = (q.totalXnft * XNFT_USD) / book
                  return (
                    <Tr key={l.xployee.id} index={i}>
                      <Td>
                        <Link to={`/xployee/${l.xployee.id}`} className="flex min-h-11 items-center gap-2.5 hover:underline">
                          <XployeeArt xployee={l.xployee} size={32} animated={false} className="" />
                          <span className="ui ui-10">{serial(l.xployee.id)}</span>
                        </Link>
                      </Td>
                      <Td>
                        <TierBadge tier={l.xployee.tier} />
                      </Td>
                      <Td className="text-[10px] text-ink-mute">
                        {l.xployee.skills.map((h) => h.skill.label).join(' · ')}
                      </Td>
                      <Td align="right">{pct(l.xployee.apy, 1)}</Td>
                      <Td align="right">{usd(book, 0)}</Td>
                      <Td align="right" className="text-ink-mute">
                        {xnft(q.askXnft)}
                      </Td>
                      <Td align="right" className="text-ink-mute">
                        {xnft(q.feeXnft)}
                      </Td>
                      <Td align="right">{xnft(q.totalXnft)}</Td>
                      <Td align="right" className="text-ink-mute">
                        {ratio.toFixed(2)}×
                      </Td>
                      {/* The cell gives up its padding so the link can own the
                          full row height. A 25px target in a table is the worst
                          offender on a phone, and the alternative — min-h-11
                          inside the cell's own py-2.5 — would push the row to
                          64px. This way the target is 44px and the row is 44px. */}
                      <Td align="right" className="p-0">
                        <Link
                          to={`/xployee/${l.xployee.id}`}
                          className="ui ui-10 flex min-h-11 items-center justify-end px-3 hover:bg-ink hover:text-paper"
                        >
                          View
                        </Link>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </Panel>
        )
      ) : contracts.length === 0 ? (
        <Empty title="No contract listings">Nothing at this tier is currently up for hire.</Empty>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contracts.slice(0, 3).map((l) => (
              <ContractCard key={l.xployee.id} listing={l} />
            ))}
          </div>

          <Panel
            title="Contract Listings"
            right={`Quote only · ${num(contracts.length)} shown`}
            bodyClassName="p-0"
          >
            <Table>
              <thead>
                <tr>
                  <Th>xployee</Th>
                  <Th>Tier</Th>
                  <Th align="right">APY</Th>
                  <Th align="right">Fee / Epoch</Th>
                  <Th align="right">Term</Th>
                  <Th align="right">Gross</Th>
                  <Th align="right">Fee {RENT_FEE_LABEL}</Th>
                  <Th align="right">Total Cost</Th>
                  <Th align="right">Proj. Output</Th>
                  <Th align="right">Renter Margin</Th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((l, i) => {
                  const m = contractMath(l)
                  return (
                    <Tr key={l.xployee.id} index={i}>
                      <Td>
                        <Link to={`/xployee/${l.xployee.id}`} className="flex min-h-11 items-center gap-2.5 hover:underline">
                          <XployeeArt xployee={l.xployee} size={32} animated={false} className="" />
                          <span className="ui ui-10">{serial(l.xployee.id)}</span>
                        </Link>
                      </Td>
                      <Td>
                        <TierBadge tier={l.xployee.tier} />
                      </Td>
                      <Td align="right">{pct(l.xployee.apy, 1)}</Td>
                      <Td align="right">{xnft(l.feePerEpoch)}</Td>
                      <Td align="right">{l.term} ep</Td>
                      <Td align="right" className="text-ink-mute">
                        {xnft(m.grossXnft)}
                      </Td>
                      <Td align="right" className="text-ink-mute">
                        {xnft(m.feeXnft)}
                      </Td>
                      <Td align="right">{xnft(m.costXnft)}</Td>
                      <Td align="right">{xnft(m.projectedYieldXnft)}</Td>
                      <Td align="right">
                        {m.marginXnft >= 0 ? '▲' : '▼'} {pct(Math.abs(m.marginPct), 1)}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          </Panel>
        </>
      )}
    </div>
  )
}

function ContractCard({ listing }: { listing: ContractListing }) {
  const m = contractMath(listing)
  const favourable = m.marginXnft >= 0

  return (
    <Panel
      title={`Contract ${serial(listing.xployee.id)}`}
      right={favourable ? 'Renter favoured' : 'Owner favoured'}
    >
      <div className="flex gap-4">
        <XployeeArt xployee={listing.xployee} size={96} className="shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <TierBadge tier={listing.xployee.tier} />
          <div className="text-[10px] leading-tight text-ink-mute">
            {listing.xployee.skills.map((h) => h.skill.label).join(' · ')}
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="outline">{listing.term} epochs</Chip>
            <Chip tone="mute">{pct(listing.xployee.apy, 1)} APY</Chip>
          </div>
        </div>
      </div>

      {/* Gross, fee and total are three separate lines on purpose: the total is
          what the wallet will be asked to sign, and nobody should meet it for the
          first time in the signature prompt. */}
      <div className="mt-4 space-y-1.5 border-t border-rule pt-3 text-[11px]">
        <div className="flex justify-between">
          <span className="text-ink-faint">
            Gross · {listing.term} × {xnft(listing.feePerEpoch)}
          </span>
          <span className="tabular-nums">{xnft(m.grossXnft)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-faint">Marketplace fee · {RENT_FEE_LABEL}</span>
          <span className="tabular-nums">{xnft(m.feeXnft)}</span>
        </div>
        <div className="flex justify-between border-t border-rule pt-1.5">
          <span className="ui ui-10">You pay</span>
          <span className="tabular-nums">{xnft(m.costXnft)}</span>
        </div>
        <div className="flex justify-between pt-1.5">
          <span className="text-ink-faint">Projected output</span>
          <span className="tabular-nums">{xnft(m.projectedYieldXnft)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-faint">Margin</span>
          <span className="tabular-nums">
            {favourable ? '▲' : '▼'} {xnft(Math.abs(m.marginXnft))}
          </span>
        </div>
      </div>

      {/* Disabled rather than wired to a no-op handler. A rental is a real
          transfer — one signature moving the gross to the owner and the fee to
          the treasury — so a button that looks live and does nothing is the one
          shape this card must not take. */}
      <div className="mt-4">
        <Button variant="outline" className="w-full" disabled>
          Take contract · <span className="keep-case">{xnft(m.costXnft)}</span>
        </Button>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
          A rental settles on-chain: the renter signs one transaction paying the owner{' '}
          {xnft(m.grossXnft)} and the treasury {xnft(m.feeXnft)}, and the xployee never moves.
          Disabled until $xNFT exists — this board quotes, it does not send.
        </p>
      </div>
    </Panel>
  )
}
