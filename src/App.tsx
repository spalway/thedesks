import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Overview } from './pages/Overview'
import { Marketplace } from './pages/Marketplace'
import { XployeeSheet } from './pages/XployeeSheet'
import { Mint } from './pages/Mint'
import { Portfolio } from './pages/Portfolio'
import { XNet } from './pages/XNet'
import { WalletSheet } from './pages/WalletSheet'
import { Transactions } from './pages/Transactions'
import { Payments } from './pages/Payments'
import { Profile } from './pages/Profile'
import { Token } from './pages/Token'
import { Docs } from './pages/Docs'
import { NotFound } from './pages/NotFound'

/**
 * Split out, and this is load-bearing rather than tidiness.
 *
 * Payouts imports lib/usePayouts, which imports lib/spl, which drags
 * @solana/web3.js and @solana/spl-token behind it — roughly 250kB. A static
 * import here puts all of that in the entry chunk of every route, which
 * silently cancels the React.lazy boundary Mint.tsx already wraps around
 * BurnGate for exactly this reason. Layout.tsx was fixed for the same reason
 * and reaches lib/spl through a dynamic import; this was the other half of the
 * same chain, and leaving one of the two static keeps the whole cost.
 *
 * Only the treasury operator ever opens this route, so nobody else should pay
 * to download it.
 */
const Payouts = lazy(() => import('./pages/Payouts').then((m) => ({ default: m.Payouts })))

/** Same reasoning as Payouts: it reaches Solana, and only the operator opens it. */
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })))

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="mint" element={<Mint />} />
        <Route path="portfolio" element={<Portfolio />} />
        <Route path="xnet" element={<XNet />} />
        <Route path="token" element={<Token />} />
        {/* The visitor's own payout queue. Distinct from /payouts, which is the
            authority-only desk that settles them. */}
        <Route path="payments" element={<Payments />} />
        <Route path="wallet/:address" element={<WalletSheet />} />
        <Route path="transactions" element={<Transactions />} />
        {/* Registered for everyone; the page itself refuses any wallet that is
            not the treasury operator. Hiding the route instead would only hide
            it from people who cannot read a bundle — and the real gate is the
            treasury keypair, which no client-side check establishes. */}
        <Route
          path="payouts"
          element={
            <Suspense fallback={null}>
              <Payouts />
            </Suspense>
          }
        />
        {/* Unlisted — no nav entry anywhere. That hides it from visitors, not
            from anyone reading the bundle, which is why the page gates payment
            on the dev wallet's signature rather than on the URL being obscure. */}
        <Route
          path="admin"
          element={
            <Suspense fallback={null}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="profile" element={<Profile />} />
        <Route path="xployee/:id" element={<XployeeSheet />} />
        <Route path="docs" element={<Docs />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
