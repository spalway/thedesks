import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SolLogo } from './SolLogo'
import { useWallet } from '../lib/wallet'
import { useHoldings } from '../lib/useHoldings'
import { useNow } from '../lib/useNow'
import { earningsFor, loadRequests, subscribeRequests, type PaymentRequest } from '../lib/earnings'
import { usd } from '../lib/format'

/**
 * The earnings pill — the Connect button's shape in the money colour.
 *
 * Green comes from the `money` token, so it is #12813c on paper and lifts to
 * #3ddc84 in the dark theme; the label is `paper`, which swaps with it. That
 * pairing is the reason no colour is hardcoded here — white on #3ddc84 would be
 * unreadable, and near-black on #12813c would be worse.
 *
 * Hidden entirely without a wallet. A "$0.00" pill for a visitor who has not
 * connected is an invitation to wonder what they did wrong.
 */
export function EarningsPill() {
  const { address } = useWallet()
  const holdings = useHoldings()
  // 5s, not the 1s the Portfolio readout runs at. This lives in the header, and
  // a per-second tick re-renders the whole nav to move a digit nobody is
  // watching at two decimal places.
  const now = useNow(5_000)
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const navigate = useNavigate()

  // Subscribed rather than read once: requesting a payout on /payments spends
  // this figure, and the pill has to agree with the page immediately.
  useEffect(() => {
    if (!address) {
      setRequests([])
      return
    }
    const sync = () => setRequests(loadRequests(address))
    sync()
    return subscribeRequests(sync)
  }, [address])

  if (!address) return null

  const earnings = earningsFor(holdings.xployees, now, requests)

  return (
    <button
      onClick={() => navigate('/payments')}
      title="Your claimable earnings — open Payments"
      /* h-10 matches the wallet button and the inbox exactly — the three sit
         side by side in the header and must share one baseline. */
      className="ui ui-11 flex h-10 shrink-0 items-center gap-2 bg-money px-4 text-paper transition-opacity hover:opacity-85"
    >
      <SolLogo size={13} />
      {/* An amount is data: mono, its own case, no label tracking. */}
      <span className="mono tabular-nums normal-case tracking-normal">
        {usd(earnings.claimableUsd)}
      </span>
    </button>
  )
}
