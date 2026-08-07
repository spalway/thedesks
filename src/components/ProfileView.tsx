import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Panel,
  Stat,
  Table,
  Th,
  Td,
  Tr,
  TierBadge,
  Chip,
  Empty,
  Button,
  Money,
  cardTone,
  SerialTag,
} from './ui'
import { XployeeArt } from './XployeeArt'
import { XBossBadge } from './XBossBadge'
import { bookValue, trailingApy, yieldPerEpoch, accruedTotal } from '../lib/accrual'
import { xBossFor, nextRank } from '../lib/network'
import { listingFor, contractMath, saleMath, XNFT_USD } from '../lib/market'
import { serial, type Xployee } from '../lib/xployee'
import type { PublicProfile } from '../lib/publicProfile'
import { num, pct, usd, usdCompact, usdLive, xnft, shortAddress } from '../lib/format'

type Tab = 'overview' | 'crew' | 'store'

export interface ProfileActions {
  isFriend: boolean
  requestPending: boolean
  onAddFriend: () => void
  onMessage: () => void
  onTrade: () => void
}

/**
 * The profile surface, shared by your own page and anyone else's.
 *
 * One component for both is deliberate: a visitor should recognise a stranger's
 * profile instantly because it is literally the same layout as their own, with
 * the edit affordances swapped for social ones.
 */
export function ProfileView({
  profile,
  crew,
  now,
  friends,
  actions,
  editSlot,
}: {
  profile: PublicProfile
  crew: Xployee[]
  now: number
  friends: { address: string; handle: string }[]
  /** Social buttons. Omitted on your own profile. */
  actions?: ProfileActions
  /** Rendered under the Overview tab on your own profile. */
  editSlot?: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>('overview')

  const stats = useMemo(() => {
    const value = crew.reduce((s, x) => s + bookValue(x, now), 0)
    const perEpoch = crew.reduce((s, x) => s + yieldPerEpoch(x), 0)
    const accrued = crew.reduce((s, x) => s + accruedTotal(x, now), 0)
    const avgApy = crew.length ? crew.reduce((s, x) => s + x.apy, 0) / crew.length : 0
    const best = [...crew].sort((a, b) => b.tier.skills - a.tier.skills)[0]
    return { value, perEpoch, accrued, avgApy, best }
  }, [crew, now])

  const rank = xBossFor(stats.value)
  const next = nextRank(stats.value)
  const pfp = crew.find((x) => x.id === profile.pfpXployeeId) ?? crew[0]

  const listings = crew.map((x) => ({ x, listing: listingFor(x.id) })).filter((r) => r.listing)

  return (
    <div className="space-y-5">
      {/* ---- Identity + headline metrics ---------------------------------- */}
      <Panel
        title={profile.isOwn ? 'Profile' : `Trader — ${profile.displayName}`}
        right={<span className="mono normal-case tracking-normal">{shortAddress(profile.address, 6, 6)}</span>}
      >
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <div className="min-w-0 space-y-3">
            {pfp ? (
              <XployeeArt xployee={pfp} size={224} fill />
            ) : (
              <div className="flex h-[224px] w-full items-center justify-center border border-dashed border-rule text-[10px] text-ink-faint">
                No xployee yet
              </div>
            )}

            <div className="ui ui-14 keep-case break-all">{profile.displayName}</div>

            <XBossBadge rank={rank} size="lg" />

            {/* Bio sits directly under the rank tag, per the brief. */}
            {profile.bio ? (
              <p className="text-[11px] leading-relaxed text-ink-mute">{profile.bio}</p>
            ) : null}

            {profile.twitter ? (
              <a
                href={`https://x.com/${profile.twitter}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mono inline-flex min-h-11 items-center gap-1.5 text-[11px] underline"
              >
                <XGlyph />@{profile.twitter}
              </a>
            ) : profile.isOwn ? (
              <span className="text-[10px] text-ink-faint">No X account linked</span>
            ) : null}

            {actions ? (
              <div className="flex flex-wrap gap-2 border-t border-rule pt-3">
                <Button variant="outline" onClick={actions.onMessage}>
                  Message
                </Button>
                <Button variant="outline" onClick={actions.onTrade}>
                  Trade
                </Button>
                <Button
                  onClick={actions.onAddFriend}
                  disabled={actions.isFriend || actions.requestPending}
                >
                  {actions.isFriend ? 'Friends' : actions.requestPending ? 'Requested' : 'Add friend'}
                </Button>
              </div>
            ) : null}
          </div>

          {/* min-w-0: the Crew tab puts a six-column table in this track, and a
              grid item's automatic minimum is its min-content width — the
              table's own overflow-x keeps it from painting outside the panel but
              does not stop it demanding the room, so without this the profile
              scrolls the page sideways on a phone. */}
          <div className="min-w-0 space-y-4">
            {/* Front-page-scale metrics, as asked. */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
              <Stat label="Crew Value" value={<Money>{usdCompact(stats.value)}</Money>} sub="book value" />
              <Stat label="Crew Size" value={num(crew.length)} sub="xployees held" />
              <Stat label="Per Epoch" value={<Money>{usd(stats.perEpoch, 2)}</Money>} sub="crew output" />
              <Stat label="Avg APY" value={pct(stats.avgApy, 1)} sub="across desks" />
              <Stat
                label="Best Pull"
                value={stats.best ? <TierBadge tier={stats.best.tier} size="lg" /> : '—'}
                sub={stats.best ? serial(stats.best.id) : 'no crew'}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-3 text-[10px] text-ink-faint">
              <span>
                {next
                  ? `${usd(next.remaining, 0)} more crew value to reach ${next.rank}.`
                  : 'Holds the top rank on the ladder.'}
              </span>
              {profile.isOwn ? <Chip tone="mute">Your wallet</Chip> : null}
            </div>

            {/* ---- Tabs ---------------------------------------------------- */}
            <div className="flex">
              {(
                [
                  ['overview', 'Overview'],
                  ['crew', 'Crew'],
                  ['store', 'Store'],
                ] as const
              ).map(([key, label], i) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`ui ui-10 min-h-11 border border-ink px-4 py-2 ${i > 0 ? 'border-l-0' : ''} ${
                    tab === key ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-wash'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'overview' ? (
              <CrewSummary crew={crew} friends={friends} accrued={stats.accrued} now={now} />
            ) : null}
            {tab === 'crew' ? <CrewTable crew={crew} now={now} /> : null}
            {tab === 'store' ? <Store listings={listings} now={now} owner={profile.displayName} /> : null}
          </div>
        </div>
      </Panel>

      {tab === 'overview' && editSlot ? editSlot : null}
    </div>
  )
}

/** The X logo, drawn rather than imported — one glyph is not worth an icon set. */
function XGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden>
      <path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.6l-5.2-6.8L5.5 22H2.4l7.6-8.7L1.2 2h6.8l4.7 6.2L18.9 2Zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20Z" />
    </svg>
  )
}

function CrewSummary({
  crew,
  friends,
  accrued,
  now,
}: {
  crew: Xployee[]
  friends: { address: string; handle: string }[]
  accrued: number
  now: number
}) {
  const byTier = new Map<string, number>()
  for (const x of crew) byTier.set(x.tier.label, (byTier.get(x.tier.label) ?? 0) + 1)

  const deskCount = new Map<string, number>()
  for (const x of crew) for (const h of x.skills) deskCount.set(h.skill.desk, (deskCount.get(h.skill.desk) ?? 0) + 1)
  const topDesks = [...deskCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="border border-rule p-3">
        <div className="ui ui-10 mb-3 text-ink-mute">Crew Summary</div>
        {crew.length === 0 ? (
          <p className="text-[11px] text-ink-faint">No xployees on the books yet.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-3">
              {crew.slice(0, 10).map((x) => (
                <Link key={x.id} to={`/xployee/${x.id}`} title={`${serial(x.id)} — ${x.tier.label}`}>
                  <XployeeArt xployee={x} size={48} animated={false} className="" />
                </Link>
              ))}
              {crew.length > 10 ? (
                <span className="self-center text-[10px] text-ink-faint">+{crew.length - 10} more</span>
              ) : null}
            </div>
            <div className="space-y-1 border-t border-rule pt-2 text-[10px]">
              {[...byTier.entries()].map(([label, n]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-ink-faint">{label}</span>
                  <span className="mono tabular-nums">{n}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-rule pt-1">
                <span className="text-ink-faint">Unclaimed</span>
                <Money>{usdLive(accrued)}</Money>
              </div>
            </div>
            <div className="mt-3 border-t border-rule pt-2">
              <div className="ui ui-10 mb-1.5 text-ink-mute">Busiest Desks</div>
              {topDesks.map(([desk, n]) => (
                <div key={desk} className="flex justify-between text-[10px]">
                  <span className="text-ink-faint">{desk}</span>
                  <span className="mono tabular-nums">{n}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-2 text-[10px] text-ink-faint">
          Trailing figures refresh each epoch · {new Date(now).getFullYear()}
        </div>
      </div>

      <div className="border border-rule p-3">
        <div className="ui ui-10 mb-3 text-ink-mute">Friends · {friends.length}</div>
        {friends.length === 0 ? (
          <p className="text-[11px] text-ink-faint">No connections yet.</p>
        ) : (
          <div className="space-y-1.5">
            {friends.slice(0, 12).map((f) => (
              <Link
                key={f.address}
                to={`/wallet/${f.address}`}
                className="flex min-h-11 items-center justify-between border border-rule px-2.5 py-1.5 hover:bg-wash"
              >
                <span className="mono text-[11px]">{f.handle}</span>
                <span className="mono text-[10px] text-ink-faint">{shortAddress(f.address)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CrewTable({ crew, now }: { crew: Xployee[]; now: number }) {
  if (crew.length === 0) return <Empty title="No xployees">This wallet holds nothing right now.</Empty>
  return (
    <Table>
      <thead>
        <tr>
          <Th>xployee</Th>
          <Th>Tier</Th>
          <Th>Desks</Th>
          <Th align="right">APY</Th>
          <Th align="right">Trailing</Th>
          <Th align="right">Book</Th>
        </tr>
      </thead>
      <tbody>
        {crew.map((x, i) => (
          <Tr key={x.id} index={i}>
            <Td>
              {/* min-h-11: the 32px art set the link's height, which left the
                  main row target at 38px. */}
              <Link to={`/xployee/${x.id}`} className="flex min-h-11 items-center gap-2.5 hover:underline">
                <XployeeArt xployee={x} size={32} animated={false} className="" />
                <span className="mono">{serial(x.id)}</span>
              </Link>
            </Td>
            <Td>
              <TierBadge tier={x.tier} />
            </Td>
            <Td className="text-[10px] text-ink-mute">{x.skills.map((h) => h.skill.desk).join(' · ')}</Td>
            <Td align="right">{pct(x.apy, 1)}</Td>
            <Td align="right">{pct(trailingApy(x, now).rate, 1)}</Td>
            <Td align="right">
              <Money>{usd(bookValue(x, now), 0)}</Money>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  )
}

function Store({
  listings,
  now,
  owner,
}: {
  listings: { x: Xployee; listing: ReturnType<typeof listingFor> }[]
  now: number
  owner: string
}) {
  if (listings.length === 0) {
    return <Empty title="Store is empty">{owner} has nothing listed for sale or contract.</Empty>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map(({ x, listing }) => {
        if (!listing) return null
        const isSale = listing.kind === 'sale'
        const m = listing.kind === 'contract' ? contractMath(listing) : null
        const s = listing.kind === 'sale' ? saleMath(listing) : null
        // What the listing leads with, and what it actually costs. The second
        // number is the one that used to be missing.
        const headlineXnft = listing.kind === 'contract' ? listing.feePerEpoch : listing.price
        const totalXnft = m ? m.costXnft : s ? s.totalXnft : 0
        return (
          <Link
            key={x.id}
            to={`/xployee/${x.id}`}
            className={`border border-ink bg-paper transition-colors ${
              cardTone(x.tier.id) || 'hover:bg-wash'
            }`}
          >
            <XployeeArt xployee={x} size={160} fill animated={false} framed={false} bottomRule />
            <div className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <SerialTag tier={x.tier}>{serial(x.id)}</SerialTag>
                <Chip tone="outline">{isSale ? 'For sale' : 'For hire'}</Chip>
              </div>
              <TierBadge tier={x.tier} />
              <div className="flex items-center justify-between border-t border-rule pt-2 text-[10px]">
                <span className="text-ink-faint">{isSale ? 'Ask' : 'Fee / epoch'}</span>
                <span className="mono tabular-nums">{xnft(headlineXnft)}</span>
              </div>
              {/* The card is small, but the total still gets its own line — a
                  price with the fee missing is the one number that misleads. */}
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-ink-faint">Total w/ fee</span>
                <span className="mono tabular-nums">{xnft(totalXnft)}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-ink-faint">{isSale ? 'Book' : 'Renter margin'}</span>
                {isSale ? (
                  <Money>{usd(bookValue(x, now), 0)}</Money>
                ) : (
                  <span className="mono tabular-nums">
                    {m && m.marginXnft >= 0 ? '▲' : '▼'} {m ? pct(Math.abs(m.marginPct), 1) : '—'}
                  </span>
                )}
              </div>
              {s ? (
                <div className="text-[10px] text-ink-faint">≈ {usd(s.totalXnft * XNFT_USD)}</div>
              ) : null}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
