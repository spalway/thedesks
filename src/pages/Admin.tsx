import { useCallback, useEffect, useMemo, useState } from 'react'
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { Panel, Stat, Table, Th, Td, Tr, Empty, Chip, Button } from '../components/ui'
import { useWallet } from '../lib/wallet'
import { useAdminGate } from '../lib/useAdmin'
import { useNow } from '../lib/useNow'
import { getConnection } from '../lib/spl'
import { useRuntimeConfig } from '../lib/useRuntimeConfig'
import { explorerTx } from '../lib/solana'
import {
  fetchAllPayoutRequests,
  settlePayoutRequest,
  isSupabaseConfigured,
  isSupabaseError,
  type PayoutRequestRow,
} from '../lib/supabase'
import { num, usd, shortAddress, dateTime } from '../lib/format'

/**
 * The operator's payout desk.
 *
 * Two gates, and they are worth very different amounts. The passcode decides
 * which pixels render and can be bypassed by anyone willing to open devtools —
 * see lib/useAdmin. The dev wallet decides whether money can move, and cannot be
 * bypassed at all, because paying a request means producing a signature from the
 * keypair that holds the SOL. Every control that spends anything is behind the
 * second gate, never the first.
 */

/** The promise the claim modal makes to a requester. Anything older is late. */
const SLA_MS = 3 * 60 * 60 * 1000

/** How often the queue re-reads. There is no websocket here — see PollNote. */
const POLL_MS = 15_000

type Stage = 'idle' | 'building' | 'signing' | 'recording' | 'done' | 'error'

interface Settling {
  claimId: string
  stage: Stage
  message?: string
  signature?: string
}

export function Admin() {
  const gate = useAdminGate()
  const { address, signAndSendTransaction } = useWallet()
  const now = useNow(POLL_MS)

  const [rows, setRows] = useState<PayoutRequestRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [settling, setSettling] = useState<Settling | null>(null)

  // Polled, not subscribed. Re-reading on the same clock the rest of the app
  // ticks on keeps this to one timer rather than a second scheduler.
  useEffect(() => {
    if (!gate.unlocked || !isSupabaseConfigured()) return
    let live = true
    void fetchAllPayoutRequests().then((result) => {
      if (!live) return
      setLoaded(true)
      if (isSupabaseError(result)) {
        setLoadError(result.message)
        return
      }
      setLoadError(null)
      setRows(result.rows)
    })
    return () => {
      live = false
    }
  }, [gate.unlocked, now])

  // Subscribed, not read once: an operator who fixes the dev wallet in Supabase
  // should see this page re-gate without reloading.
  const config = useRuntimeConfig()
  const devWallet = config.devWallet
  const isOperator = Boolean(address) && address === devWallet && devWallet !== ''

  const pending = useMemo(() => rows.filter((r) => r.status === 'pending'), [rows])
  const owedLamports = useMemo(
    () => pending.reduce((sum, r) => sum + r.amountLamports, 0n),
    [pending],
  )
  const overdue = useMemo(
    () => pending.filter((r) => now - r.requestedAt > SLA_MS).length,
    [pending, now],
  )

  const pay = useCallback(
    async (row: PayoutRequestRow) => {
      // Refuses rather than trusting the button's disabled state: a stale render
      // is exactly how a settled request gets paid a second time.
      if (!address || !isOperator || !signAndSendTransaction) return
      if (row.status !== 'pending') return
      if (settling && settling.stage !== 'done' && settling.stage !== 'error') return

      setSettling({ claimId: row.claimId, stage: 'building' })

      let recipient: PublicKey
      let payer: PublicKey
      try {
        recipient = new PublicKey(row.wallet)
        payer = new PublicKey(address)
      } catch {
        setSettling({ claimId: row.claimId, stage: 'error', message: 'That request carries an unparseable wallet address. Nothing was sent.' })
        return
      }

      let signature: string
      try {
        // getConnection(), not `new Connection(DEFAULT_RPC)`. This page sends
        // real SOL, and it was the one call in the app hardcoded to the public
        // endpoint — so the highest-stakes transaction in the protocol would
        // have gone on ignoring the operator's own RPC even after rpc_url was
        // wired up everywhere else.
        const connection = getConnection()
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: payer,
            toPubkey: recipient,
            lamports: row.amountLamports,
          }),
        )
        const { blockhash } = await connection.getLatestBlockhash('confirmed')
        tx.recentBlockhash = blockhash
        tx.feePayer = payer

        setSettling({ claimId: row.claimId, stage: 'signing' })
        signature = await signAndSendTransaction(tx)
      } catch (e) {
        const detail = e instanceof Error ? e.message : 'unknown error'
        setSettling({ claimId: row.claimId, stage: 'error', message: `Not sent: ${detail}` })
        return
      }

      // Past this line the SOL has left. Nothing below may present the payout as
      // failed — an operator who reads "failed" pays it again out of their own
      // pocket. A recording failure is reported as exactly that.
      setSettling({ claimId: row.claimId, stage: 'recording', signature })
      const recorded = await settlePayoutRequest({
        claimId: row.claimId,
        signature,
        paidLamports: row.amountLamports,
      })

      if (isSupabaseError(recorded)) {
        setSettling({
          claimId: row.claimId,
          stage: 'error',
          signature,
          message: `PAID, but the index did not record it: ${recorded.message} — do NOT pay again. Keep the signature.`,
        })
        return
      }

      setSettling({ claimId: row.claimId, stage: 'done', signature })
      setRows((prev) =>
        prev.map((r) =>
          r.claimId === row.claimId
            ? { ...r, status: 'paid', signature, paidLamports: r.amountLamports, paidAt: Date.now() }
            : r,
        ),
      )
    },
    [address, isOperator, signAndSendTransaction, settling],
  )

  if (!gate.unlocked) return <Lock gate={gate} />

  return (
    <div className="space-y-5">
      <Panel title="Admin — Payout Desk" right={<button className="ui ui-10 underline" onClick={gate.lock}>Lock</button>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pending" value={num(pending.length)} sub="awaiting payment" />
          <Stat
            label="Owed"
            value={`${(Number(owedLamports) / LAMPORTS_PER_SOL).toFixed(4)} SOL`}
            sub="across pending requests"
          />
          <Stat
            label="Past SLA"
            value={num(overdue)}
            sub="older than 3 hours"
            accent={overdue > 0 ? 'var(--color-down)' : undefined}
          />
          <Stat label="Total Seen" value={num(rows.length)} sub="all statuses" />
        </div>
        <OperatorNotice isOperator={isOperator} address={address} devWallet={devWallet} />
      </Panel>

      {!isSupabaseConfigured() ? (
        <Empty title="No index configured">
          The payout queue lives in Supabase, and this build has no project configured. Set
          <span className="mono"> VITE_SUPABASE_URL </span> and
          <span className="mono"> VITE_SUPABASE_ANON_KEY </span> to see requests here.
        </Empty>
      ) : loadError ? (
        <Empty title="Could not read the queue">{loadError}</Empty>
      ) : !loaded ? (
        <Empty title="Loading requests…">Reading the payout queue.</Empty>
      ) : rows.length === 0 ? (
        <Empty title="No payout requests yet">
          Requests appear here the moment someone submits one from the Payments page.
        </Empty>
      ) : (
        <Panel title="Requests" right={`refreshes every ${POLL_MS / 1000}s`} bodyClassName="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Claim ID</Th>
                <Th>Wallet</Th>
                <Th align="right">Amount</Th>
                <Th align="right">SOL</Th>
                <Th>Requested</Th>
                <Th>Status</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <RequestRow
                  key={row.claimId}
                  row={row}
                  index={i}
                  now={now}
                  isOperator={isOperator}
                  settling={settling?.claimId === row.claimId ? settling : null}
                  onPay={() => void pay(row)}
                />
              ))}
            </tbody>
          </Table>
        </Panel>
      )}

      <PollNote />
    </div>
  )
}

function RequestRow({
  row,
  index,
  now,
  isOperator,
  settling,
  onPay,
}: {
  row: PayoutRequestRow
  index: number
  now: number
  isOperator: boolean
  settling: Settling | null
  onPay: () => void
}) {
  const late = row.status === 'pending' && now - row.requestedAt > SLA_MS
  const busy = settling !== null && settling.stage !== 'done' && settling.stage !== 'error'

  return (
    <Tr index={index}>
      <Td>
        <span className="mono keep-case text-[11px]">{row.claimId}</span>
      </Td>
      <Td className="text-ink-faint" title={row.wallet}>
        <span className="mono keep-case">{shortAddress(row.wallet, 4, 4)}</span>
      </Td>
      <Td align="right">{usd(row.amountUsd)}</Td>
      <Td align="right" className="tabular-nums">
        {(Number(row.amountLamports) / LAMPORTS_PER_SOL).toFixed(4)}
      </Td>
      <Td className="whitespace-nowrap text-ink-mute">
        {dateTime(row.requestedAt)}
        {late ? <span className="ml-2 text-down">late</span> : null}
      </Td>
      <Td>
        <Chip tone={row.status === 'paid' ? 'ink' : row.status === 'pending' ? 'outline' : 'mute'}>
          {row.status}
        </Chip>
      </Td>
      <Td align="right">
        {row.status !== 'pending' ? (
          row.signature ? (
            <a
              className="ui ui-10 underline"
              href={explorerTx(row.signature)}
              target="_blank"
              rel="noreferrer noopener"
            >
              View
            </a>
          ) : (
            <span className="text-ink-faint">—</span>
          )
        ) : (
          <Button onClick={onPay} disabled={!isOperator || busy}>
            {busy ? stageLabel(settling.stage) : 'Pay'}
          </Button>
        )}
        {settling?.message ? (
          <div className="mt-1 max-w-[280px] text-right text-[10px] leading-snug text-down">
            {settling.message}
          </div>
        ) : null}
      </Td>
    </Tr>
  )
}

function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'building':
      return 'Building…'
    case 'signing':
      return 'Sign in wallet…'
    case 'recording':
      return 'Recording…'
    default:
      return 'Working…'
  }
}

function OperatorNotice({ isOperator, address, devWallet }: { isOperator: boolean; address: string | null; devWallet: string }) {
  if (isOperator) {
    return (
      <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
        Connected as the dev wallet. Paying a request signs a SOL transfer from this wallet directly
        to the requester — it is sent the moment you approve it in your wallet, and cannot be undone.
      </p>
    )
  }
  return (
    <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-down">
      {devWallet === ''
        ? 'No dev wallet is configured in this build, so nothing can be paid from here. The queue is read-only.'
        : address
          ? `Connected wallet is not the dev wallet (${shortAddress(devWallet, 4, 4)}). You can read the queue but not pay from it.`
          : 'Connect the dev wallet to pay requests. Until then this queue is read-only.'}
    </p>
  )
}

/**
 * Says out loud what the passcode is and is not, on the page rather than only in
 * a comment — an operator who believes this desk is protected will treat the URL
 * as a secret, and it is not one.
 */
function Lock({ gate }: { gate: ReturnType<typeof useAdminGate> }) {
  const [value, setValue] = useState('')

  return (
    <div className="mx-auto max-w-md">
      <Panel title="Admin">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void gate.submit(value)
          }}
          className="space-y-3"
        >
          <label className="block">
            <span className="ui ui-10 text-ink-mute">Passcode</span>
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1.5 min-h-11 w-full border border-ink bg-paper px-3 py-2 text-[12px] outline-none focus:bg-wash"
            />
          </label>
          {gate.error ? <p className="text-[11px] text-down">{gate.error}</p> : null}
          <Button type="submit" disabled={gate.checking || value.length === 0}>
            {gate.checking ? 'Checking…' : 'Unlock'}
          </Button>
          <p className="text-[10px] leading-relaxed text-ink-faint">
            This passcode hides the desk from casual visitors and nothing more — anyone who can read
            this page's code can get past it. Payments are gated separately on the dev wallet's
            signature, which is the control that actually holds.
          </p>
        </form>
      </Panel>
    </div>
  )
}

function PollNote() {
  return (
    <p className="max-w-3xl text-[10px] leading-relaxed text-ink-faint">
      The queue polls every {POLL_MS / 1000} seconds rather than streaming — this client talks to
      Postgres over REST and holds no websocket. A request can therefore be up to that long old
      before it appears. Amounts are what the requester's browser asserted at request time; the
      signature recorded against a payment is the authority on what was actually sent.
    </p>
  )
}
