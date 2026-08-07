import type { ReactNode } from 'react'
import { Chip, Button, Money } from './ui'
import { useBurn } from '../lib/useBurn'
import {
  MINT_COST,
  BURN_ADDRESS,
  isBurnConfigured,
  explorerTx,
  isBurnError,
  type BurnError,
} from '../lib/solana'
import { fromRawUnits, mintAmount } from '../lib/fees'
import { useWallet } from '../lib/wallet'
import { num, shortAddress } from '../lib/format'

/**
 * The paywall in front of minting: one transaction carrying one transfer of
 * 10,000 $xNFT to Solana's incinerator, under one signature.
 *
 * This is the only component in the app that moves real value, so it is
 * deliberately blunt about it. Nothing fires without a click, and the amount is
 * on screen before the button.
 *
 * There used to be three lines here — burn, 5% protocol fee, total — because the
 * fee had to be disclosed rather than buried in a difference. The fee is gone, so
 * the disclosure is one line, and the copy says outright that nothing else leaves
 * the wallet. A row reading "Protocol fee — 0" would be worse than no row: it
 * would tell a visitor to expect a charge that does not exist and leave a shape
 * behind for a future edit to fill in.
 */
export function BurnGate({
  onBurned,
  simulatedFallback,
}: {
  onBurned: () => void
  /**
   * Offered only while the mint is unconfigured. It lives here rather than beside
   * this component because BurnGate is the only thing on the page that knows
   * whether the real path is armed — reading the constant at the call site would
   * pull web3.js back into the main chunk this component is lazy-loaded to keep
   * it out of. A free simulated hire must never sit next to a live burn button as
   * if the two were the same offer.
   */
  simulatedFallback?: ReactNode
}) {
  const { address, signAndSendTransaction } = useWallet()
  const burn = useBurn(address)

  const configured = isBurnConfigured()
  const balance = burn.balance

  // Raw units, at the decimals the mint itself reports — never the `uiAmount`
  // float sitting next to it on the same object. A float is a display artifact:
  // it must not be the value that decides whether an irreversible transfer is
  // affordable. Scaling by `decimals` is safe here because spl.ts refuses to
  // resolve a mint reporting anything outside 0–18, so no balance carrying an
  // exponent that would throw ever reaches this component.
  const requiredRaw = balance ? mintAmount(balance.decimals) : null
  const shortRaw =
    balance !== null && requiredRaw !== null && balance.rawAmount < requiredRaw
      ? requiredRaw - balance.rawAmount
      : 0n

  const disabled =
    !configured ||
    !address ||
    burn.stage === 'checking' ||
    burn.stage === 'awaiting-signature' ||
    burn.stage === 'confirming' ||
    shortRaw > 0n

  const run = async () => {
    if (!signAndSendTransaction) return
    const ok = await burn.burn(signAndSendTransaction)
    if (ok) onBurned()
  }

  return (
    <div className="space-y-3 border border-ink p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="ui ui-11">Burn to hire</span>
        <Chip tone={configured ? 'ink' : 'outline'}>{configured ? 'Live' : 'Not configured'}</Chip>
      </div>

      {/* One money line, because there is one transfer. The label says both
          things at once — what is destroyed and what is debited — so nobody has
          to work out whether a fee sits somewhere off screen. */}
      <div className="space-y-1.5 text-[11px]">
        <Row label="You pay · all of it burned">
          <Money>{num(MINT_COST)} $xNFT</Money>
        </Row>
        <Row label="Burn destination">
          <span className="mono text-[10px]" title={BURN_ADDRESS}>
            {shortAddress(BURN_ADDRESS, 6, 6)}
          </span>
        </Row>
        <Row label="Your balance">
          {balance ? (
            <span className="mono tabular-nums">{num(balance.uiAmount)} $xNFT</span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </Row>
      </div>

      {!configured ? (
        <p className="border-t border-rule pt-3 text-[10px] leading-relaxed text-ink-mute">
          The mint is not armed. Until <code>XNFT_MINT_ADDRESS</code> in{' '}
          <code>src/lib/spl.ts</code> points at a real mint, this app will not build or send a
          transaction — minting stays simulated. That one address is the whole requirement: a mint
          pays no fee and has no configurable destination, so there is nothing else to set.
        </p>
      ) : shortRaw > 0n && balance ? (
        <p className="border-t border-rule pt-3 text-[10px] text-down">
          Short {num(fromRawUnits(shortRaw, balance.decimals), 2)} $xNFT of the{' '}
          {num(MINT_COST)} this mint debits.
        </p>
      ) : (
        <p className="border-t border-rule pt-3 text-[10px] leading-relaxed text-ink-mute">
          One transfer, no protocol fee — the full {num(MINT_COST)} $xNFT goes to the incinerator.
          It is <strong>irreversible</strong>: tokens sent there cannot be recovered by anyone,
          including the protocol.
        </p>
      )}

      {burn.error ? <ErrorLine error={burn.error} /> : null}

      {burn.signature ? (
        <a
          href={explorerTx(burn.signature)}
          target="_blank"
          rel="noreferrer noopener"
          className="mono block text-[10px] underline"
        >
          View burn on Solscan →
        </a>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run()} disabled={disabled}>
          {burn.stage === 'awaiting-signature'
            ? 'Confirm in wallet…'
            : burn.stage === 'confirming'
              ? 'Confirming…'
              : burn.stage === 'checking'
                ? 'Checking balance…'
                : `Burn ${num(MINT_COST)} $xNFT`}
        </Button>
        {configured ? (
          <button onClick={burn.refreshBalance} className="text-[10px] text-ink-mute underline">
            Refresh balance
          </button>
        ) : null}
      </div>

      {!configured && simulatedFallback ? (
        <div className="border-t border-rule pt-3">{simulatedFallback}</div>
      ) : null}
    </div>
  )
}

function Row({
  label,
  children,
  className = '',
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="text-ink-faint">{label}</span>
      {children}
    </div>
  )
}

/**
 * The message is rendered as-is and the numeric `shortfall` is deliberately not
 * appended: solana.ts already folds the shortfall into the sentence, in whole
 * tokens, and printing it twice reads as two different figures rather than one.
 */
function ErrorLine({ error }: { error: BurnError }) {
  if (!isBurnError(error)) return null
  return <p className="border-t border-rule pt-3 text-[10px] text-down">{error.message}</p>
}
