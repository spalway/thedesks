import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button, Chip, Empty } from './ui'
import { XployeeArt } from './XployeeArt'
import {
  loadInbox,
  sendMessage,
  markThreadRead,
  respondToFriendRequest,
  respondToOffer,
  removeFriend,
  handleFor,
  MESSAGE_MAX,
  type Inbox as InboxData,
  type TradeOffer,
} from '../lib/social'
import { byId } from '../lib/collection'
import { serial } from '../lib/xployee'
import { shortAddress, xnft, dateTime } from '../lib/format'

type Pane = 'threads' | 'requests' | 'offers' | 'friends'

/**
 * The envelope button and its drawer.
 *
 * Kept as one component because the badge count and the drawer read the same
 * inbox snapshot — splitting them would mean two loads that can disagree.
 */
export function InboxButton({ address, now }: { address: string | null; now: number }) {
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('threads')
  const [tick, setTick] = useState(0)
  const [activeThread, setActiveThread] = useState<string | null>(null)

  const inbox: InboxData | null = useMemo(
    () => (address ? loadInbox(address, now) : null),
    // `tick` forces a re-read after any mutation; `now` only seeds new content.
    [address, now, tick],
  )

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [open])

  if (!address || !inbox) return null

  const refresh = () => setTick((t) => t + 1)
  const unread = inbox.unreadTotal

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'}
        /* h-10 is shared with the wallet button and the earnings pill. The three
           sit together in the header, and matching the height explicitly beats
           hoping three different paddings round to the same box. */
        className="relative flex h-10 items-center border border-ink bg-ink px-3.5 text-paper transition-colors hover:bg-ink-mute"
      >
        <Mail className="h-5 w-5" strokeWidth={2} aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: 'var(--color-down)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {/* max-w on the drawer: 380px is wider than a 375px phone, and it hangs off
          a button that is itself near the right edge — at that width it opened
          partly off-screen with no way to reach the rest, because the page body
          must not scroll sideways. The cap keeps a 12px gutter on the narrowest
          viewport and is inert at every width the drawer already fitted. */}
      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 w-[380px] max-w-[calc(100vw-1.5rem)] border border-ink bg-paper shadow-lg">
          <div className="flex items-center justify-between bg-ink px-3 py-2">
            <span className="ui ui-10 text-paper">Inbox</span>
            <span className="ui ui-10 text-paper/60">{unread} unread</span>
          </div>

          <div className="flex border-b border-ink">
            {(
              [
                ['threads', 'Messages', inbox.threads.reduce((s, t) => s + t.unread, 0)],
                ['requests', 'Requests', inbox.incomingRequests.filter((r) => r.status === 'pending').length],
                ['offers', 'Offers', inbox.offers.filter((o) => o.to === address && o.status === 'pending').length],
                ['friends', 'Friends', 0],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => {
                  setPane(key)
                  setActiveThread(null)
                }}
                className={`ui ui-10 min-h-11 flex-1 px-2 py-2 ${
                  pane === key ? 'bg-ink text-paper' : 'text-ink hover:bg-wash'
                }`}
              >
                {label}
                {count > 0 ? <span className="ml-1 text-down">{count}</span> : null}
              </button>
            ))}
          </div>

          <div className="max-h-[420px] overflow-y-auto scrollbar-thin">
            {pane === 'threads' ? (
              <Threads
                inbox={inbox}
                address={address}
                now={now}
                active={activeThread}
                setActive={setActiveThread}
                refresh={refresh}
              />
            ) : null}
            {pane === 'requests' ? <Requests inbox={inbox} address={address} now={now} refresh={refresh} /> : null}
            {pane === 'offers' ? <Offers inbox={inbox} address={address} now={now} refresh={refresh} /> : null}
            {pane === 'friends' ? <Friends inbox={inbox} address={address} now={now} refresh={refresh} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Threads({
  inbox,
  address,
  now,
  active,
  setActive,
  refresh,
}: {
  inbox: InboxData
  address: string
  now: number
  active: string | null
  setActive: (v: string | null) => void
  refresh: () => void
}) {
  const [draft, setDraft] = useState('')
  const thread = inbox.threads.find((t) => t.with === active)

  if (thread) {
    const send = () => {
      const body = draft.trim()
      if (!body) return
      sendMessage(address, thread.with, body, Date.now())
      setDraft('')
      refresh()
    }

    return (
      <div>
        <div className="flex items-center justify-between border-b border-rule px-3 py-2">
          <button
            onClick={() => setActive(null)}
            className="ui ui-10 -my-2 inline-flex min-h-11 items-center underline"
          >
            ← All
          </button>
          <Link to={`/wallet/${thread.with}`} className="mono text-[11px] hover:underline">
            {thread.handle}
          </Link>
        </div>

        <div className="space-y-2 p-3">
          {thread.messages.map((m) => {
            const mine = m.from === address
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] px-2.5 py-1.5 text-[11px] leading-relaxed ${
                    mine ? 'bg-ink text-paper' : 'border border-rule bg-wash text-ink'
                  }`}
                >
                  {m.body}
                  <div className={`mt-1 text-[9px] ${mine ? 'text-paper/50' : 'text-ink-faint'}`}>
                    {dateTime(m.at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-2 border-t border-rule p-2">
          <input
            value={draft}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
            placeholder="Message…"
            className="min-h-11 w-full border border-ink bg-paper px-2 py-1.5 text-[11px] outline-none focus:bg-wash"
          />
          <Button onClick={send} disabled={!draft.trim()}>
            Send
          </Button>
        </div>
      </div>
    )
  }

  if (inbox.threads.length === 0) {
    return <Pad>No messages yet. Open a trader's profile to start one.</Pad>
  }

  return (
    <div>
      {inbox.threads.map((t) => (
        <button
          key={t.with}
          onClick={() => {
            markThreadRead(address, t.with)
            setActive(t.with)
            refresh()
          }}
          className="flex w-full items-center justify-between gap-3 border-b border-rule px-3 py-2.5 text-left hover:bg-wash"
        >
          <div className="min-w-0">
            <div className="mono flex items-center gap-2 text-[11px]">
              {t.handle}
              {t.unread > 0 ? <span className="text-[9px] text-down">●</span> : null}
            </div>
            <div className="truncate text-[10px] text-ink-faint">
              {t.messages[t.messages.length - 1]?.body ?? ''}
            </div>
          </div>
          <span className="shrink-0 text-[9px] text-ink-faint">{dateTime(t.lastAt).split(',')[0]}</span>
        </button>
      ))}
      <div className="px-3 py-2 text-[9px] text-ink-faint">Epoch clock: {dateTime(now)}</div>
    </div>
  )
}

function Requests({
  inbox,
  address,
  refresh,
}: {
  inbox: InboxData
  address: string
  now: number
  refresh: () => void
}) {
  const pending = inbox.incomingRequests.filter((r) => r.status === 'pending')
  if (pending.length === 0 && inbox.outgoingRequests.length === 0) {
    return <Pad>No friend requests.</Pad>
  }
  return (
    <div>
      {pending.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2.5">
          <Link to={`/wallet/${r.from}`} className="mono text-[11px] hover:underline">
            {shortAddress(r.from)}
          </Link>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                respondToFriendRequest(address, r.id, true)
                refresh()
              }}
              className="ui ui-10 min-h-11 bg-ink px-2.5 py-1 text-paper"
            >
              Accept
            </button>
            <button
              onClick={() => {
                respondToFriendRequest(address, r.id, false)
                refresh()
              }}
              className="ui ui-10 min-h-11 border border-ink px-2.5 py-1"
            >
              Decline
            </button>
          </div>
        </div>
      ))}
      {inbox.outgoingRequests.map((r) => (
        <div key={r.id} className="flex items-center justify-between border-b border-rule px-3 py-2 text-[10px]">
          <span className="mono">{shortAddress(r.to)}</span>
          <Chip tone="mute">{r.status}</Chip>
        </div>
      ))}
    </div>
  )
}

function Offers({
  inbox,
  address,
  refresh,
}: {
  inbox: InboxData
  address: string
  now: number
  refresh: () => void
}) {
  if (inbox.offers.length === 0) return <Pad>No trade offers.</Pad>
  return (
    <div>
      {inbox.offers.map((o) => (
        <OfferRow key={o.id} offer={o} address={address} refresh={refresh} />
      ))}
    </div>
  )
}

function OfferRow({ offer, address, refresh }: { offer: TradeOffer; address: string; refresh: () => void }) {
  const incoming = offer.to === address
  const give = offer.offering.map((id) => byId(id)).filter(Boolean)
  const want = offer.requesting.map((id) => byId(id)).filter(Boolean)

  return (
    <div className="border-b border-rule px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <Link to={`/wallet/${incoming ? offer.from : offer.to}`} className="mono text-[11px] hover:underline">
          {shortAddress(incoming ? offer.from : offer.to)}
        </Link>
        <Chip tone={offer.status === 'pending' ? 'outline' : 'mute'}>
          {incoming ? 'Incoming' : 'Sent'} · {offer.status}
        </Chip>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div>
          <div className="text-ink-faint">{incoming ? 'You get' : 'You give'}</div>
          <Row items={give} />
        </div>
        <div>
          <div className="text-ink-faint">{incoming ? 'You give' : 'You get'}</div>
          <Row items={want} />
        </div>
      </div>

      {offer.xnft !== 0 ? (
        <div className="mt-1.5 text-[10px]">
          <span className="text-ink-faint">Plus </span>
          <span className="mono">{xnft(Math.abs(offer.xnft))}</span>
          <span className="text-ink-faint"> {offer.xnft > 0 ? 'to you' : 'from you'}</span>
        </div>
      ) : null}

      {offer.note ? <p className="mt-1.5 text-[10px] italic text-ink-mute">“{offer.note}”</p> : null}

      {incoming && offer.status === 'pending' ? (
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => {
              respondToOffer(address, offer.id, 'accepted')
              refresh()
            }}
            className="ui ui-10 bg-ink px-2.5 py-1 text-paper"
          >
            Accept
          </button>
          <button
            onClick={() => {
              respondToOffer(address, offer.id, 'declined')
              refresh()
            }}
            className="ui ui-10 border border-ink px-2.5 py-1"
          >
            Decline
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Row({ items }: { items: ReturnType<typeof byId>[] }) {
  if (items.length === 0) return <span className="text-ink-faint">nothing</span>
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((x) =>
        x ? (
          <span key={x.id} className="flex items-center gap-1" title={serial(x.id)}>
            <XployeeArt xployee={x} size={24} animated={false} className="" />
          </span>
        ) : null,
      )}
    </div>
  )
}

function Friends({
  inbox,
  address,
  now,
  refresh,
}: {
  inbox: InboxData
  address: string
  now: number
  refresh: () => void
}) {
  if (inbox.friends.length === 0) return <Pad>No friends yet.</Pad>
  return (
    <div>
      {inbox.friends.map((f) => (
        <div key={f} className="flex items-center justify-between gap-2 border-b border-rule px-3 py-2.5">
          <Link to={`/wallet/${f}`} className="mono text-[11px] hover:underline">
            {handleFor(now, f)}
          </Link>
          <button
            onClick={() => {
              removeFriend(address, f)
              refresh()
            }}
            className="-my-2.5 inline-flex min-h-11 items-center text-[10px] text-ink-faint underline hover:text-down"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}

function Pad({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3">
      <Empty title="Nothing here">{children}</Empty>
    </div>
  )
}
