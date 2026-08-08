import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, Stat, Table, Th, Td, Tr, Empty, Button, Chip, LinkButton } from '../components/ui'
import { SolLogo } from '../components/SolLogo'
import { useWallet } from '../lib/wallet'
import { useHoldings } from '../lib/useHoldings'
import { useNow } from '../lib/useNow'
import { usePrices } from '../lib/usePrices'
import {
  MIN_REQUEST_USD,
  canRequest,
  clearRequests,
  createRequest,
  earningsFor,
  formatSol,
  loadRequests,
  saveRequest,
  subscribeRequests,
  type PaymentRequest,
} from '../lib/earnings'
import { twitterHandle, twitterUrl } from '../lib/token'
import { dateTime, num, usd, usdLive, shortAddress } from '../lib/format'

/** Hours a payout is promised within. Quoted in the modal and in the copy above it. */
const SETTLEMENT_HOURS = 3

export function Payments() {
  const { address } = useWallet()
  const holdings = useHoldings()
  const now = useNow(1_000)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [issued, setIssued] = useState<PaymentRequest | null>(null)

  useEffect(() => {
    if (!address) {
      setRequests([])
      return
    }
    const sync = () => setRequests(loadRequests(address))
    sync()
    return subscribeRequests(sync)
  }, [address])

  // Live SOL, off the same Jupiter call the ticker uses. This is the one page
  // where the rate decides how much somebody is owed, so it must not be a
  // constant — see SOL_USD_FALLBACK in lib/prices.ts for what it used to be.
  const prices = usePrices()
  const earnings = earningsFor(holdings.xployees, now, requests, prices.solUsd)

  const submit = useCallback(() => {
    if (!address || !canRequest(earnings)) return
    const request = createRequest(address, earnings, Date.now())
    saveRequest(address, request)
    // Shown, not just stored. The claim ID is the only thing the visitor has to
    // hold onto, so it goes on screen before anything else happens.
    setIssued(request)
  }, [address, earnings])

  if (!address) {
    return (
      <Panel title="Payments">
        <Empty title="Wallet not connected">
          Connect a Solana wallet from the header to see what your crew has earned. Connection is
          read-only.
        </Empty>
      </Panel>
    )
  }

  const requestable = canRequest(earnings)

  return (
    <div className="space-y-5">
      <Panel title="Payments — Your Earnings" right={<span className="keep-case">{shortAddress(address)}</span>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Claimable"
            value={usd(earnings.claimableUsd)}
            sub="net of everything already requested"
            accent="var(--color-money)"
          />
          <Stat
            label="In SOL"
            value={
              <span className="flex items-center gap-2">
                <SolLogo size={13} />
                <span className="keep-case">{formatSol(earnings.claimableSol)}</span>
              </span>
            }
            sub={
              prices.source === 'live'
                ? `at ${usd(prices.solUsd)} / SOL`
                : `at ${usd(prices.solUsd)} / SOL · cached`
            }
            accent="var(--color-money)"
          />
          <Stat
            label="Accrued"
            value={<span className="tabular-nums">{usdLive(earnings.accruedUsd)}</span>}
            sub={`lifetime, across ${num(earnings.crewSize)} xployee${earnings.crewSize === 1 ? '' : 's'}`}
          />
          <Stat
            label="In The Queue"
            value={usd(earnings.requestedUsd)}
            sub={`${num(requests.length)} request${requests.length === 1 ? '' : 's'} on file`}
          />
        </div>

        <div className="mt-5 border-t border-rule pt-4">
          <p className="mb-3 max-w-3xl text-[12px] leading-relaxed">
            <strong>Where the money comes from.</strong> Payouts are made in SOL out of the creator
            fees the <span className="keep-case">$xNFT</span> token earns on pump.fun. There is no
            payout treasury on-chain and no vault contract — it is one wallet, funded by trading fees,
            paying out by hand.
          </p>
          <p className="mb-4 max-w-3xl text-[12px] leading-relaxed">
            <strong>What the button does.</strong> Requesting a payment does not move anything. It
            issues you a claim ID and puts your wallet in a queue that a person works through. Nothing
            is signed, no transaction is built, and your wallet is not asked for anything. If a payout
            has not landed within {SETTLEMENT_HOURS} hours, the claim ID is what gets it chased up.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={submit} disabled={!requestable}>
              Request payment
            </Button>
            {!requestable ? (
              <span className="text-[11px] text-ink-faint">
                {earnings.crewSize === 0
                  ? 'You have no xployees working, so there is nothing to pay out yet.'
                  : `Nothing claimable — a request needs at least ${usd(MIN_REQUEST_USD)}.`}
              </span>
            ) : (
              <span className="text-[11px] text-ink-faint">
                Requests {usd(earnings.claimableUsd)} · {formatSol(earnings.claimableSol)}
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Request History" bodyClassName={requests.length === 0 ? 'p-4' : 'p-0'}>
        {requests.length === 0 ? (
          <Empty title="No payment requests yet">
            {earnings.crewSize === 0 ? (
              <div className="mt-4">
                <LinkButton to="/mint">Hire your first xployee →</LinkButton>
              </div>
            ) : (
              'Every request you make is listed here with its claim ID, so you can quote it later.'
            )}
          </Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Claim ID</Th>
                <Th>Requested</Th>
                <Th align="right">Amount</Th>
                <Th align="right">SOL</Th>
                <Th align="right">Status</Th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <Tr key={r.id} index={i}>
                  <Td>
                    <span className="mono keep-case select-all font-medium">{r.id}</span>
                  </Td>
                  <Td className="text-ink-mute">{dateTime(r.requestedAt)}</Td>
                  <Td align="right">
                    <span className="mono tabular-nums text-money">{usd(r.amountUsd)}</span>
                  </Td>
                  <Td align="right">
                    <span className="mono keep-case tabular-nums">{formatSol(r.amountSol)}</span>
                  </Td>
                  <Td align="right">
                    <StatusChip status={r.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <Panel title="Local Data">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-[10px] leading-relaxed text-ink-faint">
            Your requests are stored in this browser only — there is no account and no server behind
            this page yet. Clearing them removes your local record of the claim IDs, which is the
            reason to keep a copy of any you are still waiting on. See{' '}
            <Link to="/docs" className="underline">
              Docs
            </Link>{' '}
            for what is simulated here and what is not.
          </p>
          <Button variant="outline" onClick={() => clearRequests(address)}>
            Clear my requests
          </Button>
        </div>
      </Panel>

      {issued ? <ClaimModal request={issued} onClose={() => setIssued(null)} /> : null}
    </div>
  )
}

function StatusChip({ status }: { status: PaymentRequest['status'] }) {
  if (status === 'paid') {
    return (
      <span className="ui ui-10 inline-block border border-current px-1.5 py-1 text-money">Paid</span>
    )
  }
  if (status === 'rejected') return <Chip tone="mute">Rejected</Chip>
  return <Chip tone="outline">Pending</Chip>
}

/**
 * The receipt. The claim ID is the entire payload — it is what a support ticket
 * is resolved by, so it is `select-all`, copyable, and set in mono at a size you
 * can read off a phone screen.
 */
function ClaimModal({ request, onClose }: { request: PaymentRequest; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const handle = twitterHandle()
  const url = twitterUrl()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(request.id)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2_000)
    } catch {
      // Permission-gated, and absent over plain http. The ID is select-all text
      // either way, so a failed copy is not a failed request.
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-ink bg-paper scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-ink px-3.5 py-2.5">
          <span className="ui ui-11 text-paper">Payment requested</span>
          <button onClick={onClose} className="ui ui-10 text-paper/70 hover:text-paper">
            Close
          </button>
        </div>

        <div className="p-4">
          <div className="ui ui-10 text-ink-mute">Your claim ID</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 border border-ink px-3 py-3">
            <code className="mono keep-case select-all text-[18px] font-medium tracking-wide">
              {request.id}
            </code>
            <button
              onClick={() => void copy()}
              className="ui ui-10 ml-auto shrink-0 border border-ink px-2 py-1 transition-colors hover:bg-ink hover:text-paper"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Amount" value={usd(request.amountUsd)} accent="var(--color-money)" />
            <Stat
              label="Paid In"
              value={
                <span className="flex items-center gap-2">
                  <SolLogo size={13} />
                  <span className="keep-case">{formatSol(request.amountSol)}</span>
                </span>
              }
              sub={dateTime(request.requestedAt)}
            />
          </div>

          <p className="mt-4 text-[12px] leading-relaxed">
            Your request is in the queue. Payouts are sent in SOL by hand, so this is not instant and
            nothing has moved on-chain yet.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed">
            <strong>Keep this claim ID.</strong> If your payout has not arrived within{' '}
            {SETTLEMENT_HOURS} hours,{' '}
            {url && handle ? (
              <>
                message us on X at{' '}
                <a href={url} target="_blank" rel="noreferrer noopener" className="mono keep-case underline">
                  @{handle}
                </a>{' '}
                and quote it.
              </>
            ) : (
              // No handle configured: a bare '@' or a link to nowhere is worse
              // than saying plainly that the channel does not exist yet.
              <>
                quote it to us on our X account — the handle is published on the{' '}
                <Link to="/token" className="underline keep-case">
                  $xNFTs
                </Link>{' '}
                page as soon as the token launches.
              </>
            )}
          </p>

          <div className="mt-5">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
