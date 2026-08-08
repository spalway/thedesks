import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Panel, Empty, LinkButton, Button, Chip } from '../components/ui'
import { ProfileView } from '../components/ProfileView'
import { XployeeArt } from '../components/XployeeArt'
import { walletByAddress } from '../lib/network'
import { publicProfileFor, crewOf } from '../lib/publicProfile'
import { useWallet } from '../lib/wallet'
import { useHoldings } from '../lib/useHoldings'
import { useNow } from '../lib/useNow'
import {
  sendFriendRequest,
  sendMessage,
  sendTradeOffer,
  isFriend,
  loadInbox,
  friendsOf,
  handleFor,
  MESSAGE_MAX,
} from '../lib/social'
import { serial, type Xployee } from '../lib/xployee'
import { xnft } from '../lib/format'

type Modal = null | 'message' | 'trade'

export function WalletSheet() {
  const { address: routeAddress = '' } = useParams()
  const { address: viewer } = useWallet()
  const holdings = useHoldings()
  const now = useNow(5000)

  const [modal, setModal] = useState<Modal>(null)
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const wallet = walletByAddress(now, routeAddress)

  if (!wallet) {
    return (
      <Panel title="Wallet Not Found">
        <Empty title="No wallet at that address">
          <div className="mt-4">
            <LinkButton to="/xnet">Back to xNET →</LinkButton>
          </div>
        </Empty>
      </Panel>
    )
  }

  const profile = publicProfileFor(wallet, viewer)
  const crew = crewOf(wallet)

  const friends = friendsOf(wallet.address).map((a) => ({ address: a, handle: handleFor(now, a) }))

  const inbox = viewer ? loadInbox(viewer, now) : null
  const alreadyFriend = viewer ? isFriend(viewer, wallet.address) : false
  const requestPending = Boolean(
    inbox?.outgoingRequests.some((r) => r.to === wallet.address && r.status === 'pending'),
  )

  const flash = (msg: string) => {
    setTick((t) => t + 1)
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  const actions =
    viewer && viewer !== wallet.address
      ? {
          isFriend: alreadyFriend,
          requestPending,
          onAddFriend: () => {
            sendFriendRequest(viewer, wallet.address, Date.now())
            flash('Friend request sent')
          },
          onMessage: () => setModal('message'),
          onTrade: () => setModal('trade'),
        }
      : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[10px] text-ink-mute">
        {/* 24×17 was the smallest target anywhere on the site — a four-letter
            crumb at 10px. min-h-11 gives it the 44px the rest of the chrome has. */}
        <Link to="/xnet" className="inline-flex min-h-11 items-center underline">
          xNET
        </Link>
        <span>/</span>
        <span className="mono text-ink">{wallet.handle}</span>
      </div>

      {toast ? <Chip tone="ink">{toast}</Chip> : null}

      <ProfileView
        key={tick}
        profile={profile}
        crew={crew}
        now={now}
        friends={friends}
        actions={actions}
      />

      {modal === 'message' && viewer ? (
        <MessageModal
          to={wallet.address}
          handle={wallet.handle}
          onClose={() => setModal(null)}
          onSend={(body) => {
            sendMessage(viewer, wallet.address, body, Date.now())
            setModal(null)
            flash('Message sent')
          }}
        />
      ) : null}

      {modal === 'trade' && viewer ? (
        <TradeModal
          theirCrew={crew}
          myCrew={holdings.xployees}
          handle={wallet.handle}
          onClose={() => setModal(null)}
          onSend={(offering, requesting, sweetener, note) => {
            sendTradeOffer(
              viewer,
              { to: wallet.address, offering, requesting, xnft: sweetener, note },
              Date.now(),
            )
            setModal(null)
            flash('Offer sent')
          }}
        />
      ) : null}
    </div>
  )
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-ink bg-paper scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-ink px-3.5 py-2.5">
          <span className="ui ui-11 text-paper">{title}</span>
          {/* -my-2.5 keeps the title bar at its designed height while the button
              itself grows to a 44px target — the padding grows into the bar's
              own py rather than on top of it. */}
          <button
            onClick={onClose}
            className="ui ui-10 -my-2.5 inline-flex min-h-11 items-center text-paper/70 hover:text-paper"
          >
            Close
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

function MessageModal({
  to,
  handle,
  onClose,
  onSend,
}: {
  to: string
  handle: string
  onClose: () => void
  onSend: (body: string) => void
}) {
  const [body, setBody] = useState('')
  return (
    <Shell title={`Message ${handle}`} onClose={onClose}>
      <textarea
        autoFocus
        value={body}
        maxLength={MESSAGE_MAX}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Talk shop…"
        className="h-28 w-full resize-none border border-ink bg-paper px-3 py-2 text-[11px] outline-none focus:bg-wash"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] text-ink-faint">
        <span className="mono">{to.slice(0, 8)}…</span>
        <span>
          {body.length}/{MESSAGE_MAX}
        </span>
      </div>
      <div className="mt-3">
        <Button onClick={() => onSend(body.trim())} disabled={!body.trim()}>
          Send message
        </Button>
      </div>
    </Shell>
  )
}

function TradeModal({
  theirCrew,
  myCrew,
  handle,
  onClose,
  onSend,
}: {
  theirCrew: Xployee[]
  myCrew: Xployee[]
  handle: string
  onClose: () => void
  onSend: (offering: number[], requesting: number[], sweetener: number, note: string) => void
}) {
  const [offering, setOffering] = useState<number[]>([])
  const [requesting, setRequesting] = useState<number[]>([])
  const [amount, setAmount] = useState('0')
  const [note, setNote] = useState('')

  const toggle = (list: number[], set: (v: number[]) => void, id: number) =>
    set(list.includes(id) ? list.filter((i) => i !== id) : [...list, id])

  const parsed = Number(amount)
  const valid = (offering.length > 0 || requesting.length > 0 || parsed !== 0) && Number.isFinite(parsed)

  return (
    <Shell title={`Offer to ${handle}`} onClose={onClose}>
      <div className="space-y-4">
        <Picker
          label="You give"
          crew={myCrew}
          selected={offering}
          onToggle={(id) => toggle(offering, setOffering, id)}
          empty="You hold no xployees yet."
        />
        <Picker
          label={`You want from ${handle}`}
          crew={theirCrew}
          selected={requesting}
          onToggle={(id) => toggle(requesting, setRequesting, id)}
          empty="They hold nothing."
        />

        <label className="block">
          <span className="ui ui-10 keep-case text-ink-mute">$xNFT sweetener</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="mono mt-1.5 min-h-11 w-full border border-ink bg-paper px-3 py-2 text-[11px] outline-none focus:bg-wash"
          />
          <span className="mt-1 block text-[10px] text-ink-faint">
            Positive adds {xnft(Math.abs(parsed) || 0)} from you; negative asks for it back.
          </span>
        </label>

        <label className="block">
          <span className="ui ui-10 text-ink-mute">Note</span>
          <input
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
            className="mt-1.5 min-h-11 w-full border border-ink bg-paper px-3 py-2 text-[11px] outline-none focus:bg-wash"
          />
        </label>

        <Button onClick={() => onSend(offering, requesting, parsed || 0, note.trim())} disabled={!valid}>
          Send offer
        </Button>
      </div>
    </Shell>
  )
}

function Picker({
  label,
  crew,
  selected,
  onToggle,
  empty,
}: {
  label: string
  crew: Xployee[]
  selected: number[]
  onToggle: (id: number) => void
  empty: string
}) {
  return (
    <div>
      <span className="ui ui-10 text-ink-mute">{label}</span>
      {crew.length === 0 ? (
        <div className="mt-2 border border-dashed border-rule px-3 py-4 text-center text-[10px] text-ink-faint">
          {empty}
        </div>
      ) : (
        <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto scrollbar-thin">
          {crew.map((x) => {
            const on = selected.includes(x.id)
            return (
              <button
                key={x.id}
                onClick={() => onToggle(x.id)}
                title={`${serial(x.id)} — ${x.tier.label}`}
                className={`border p-0.5 ${on ? 'border-ink bg-ink' : 'border-rule hover:border-ink'}`}
              >
                <XployeeArt xployee={x} size={40} animated={false} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
