import { Panel, Stat, Table, Th, Td, Tr, Empty, Chip, Button } from '../components/ui'
import { usePayouts, formatRaw, type PayoutEntry, type PayoutStatus } from '../lib/usePayouts'
import { useWallet } from '../lib/wallet'
import { useNow } from '../lib/useNow'
import { explorerTx } from '../lib/solana'
import { dateTime, duration, shortAddress } from '../lib/format'

/**
 * The operator's fee desk.
 *
 * Three things make this page different from every other tab, and all three are
 * about not overstating what it does.
 *
 * The claimable figure is the treasury token account's live balance on Solana,
 * never the index, so it cannot be stale in the direction that matters. A claim
 * becomes a pending row the instant the wallet hands back a signature — a
 * genuinely unconfirmed transaction with a working explorer link, not a spinner
 * standing in for one. And while such a row exists the Claim button stays shut,
 * because the balance it would claim may already have moved.
 *
 * The copy below says plainly that the treasury is a wallet somebody holds the
 * key to rather than a vault a program enforces. That distinction was the
 * program's job; the program is gone, and a page that implied otherwise would be
 * describing a guarantee nobody is making.
 */
export function Payouts() {
  const { address, signAndSendTransaction } = useWallet()
  const payouts = usePayouts(address)
  // Pending rows show how long they have been pending; nothing else here ticks.
  const now = useNow(1_000)
  const desk = payouts.desk

  if (!payouts.configured) {
    return (
      <Panel title="Payouts">
        <Empty title="Treasury not configured">
          <span className="mono keep-case">XNFT_MINT_ADDRESS</span>,{' '}
          <span className="mono keep-case">TREASURY_ADDRESS</span> and{' '}
          <span className="mono keep-case">DEV_WALLET_ADDRESS</span> in{' '}
          <span className="mono keep-case">src/lib/spl.ts</span> are placeholders. Until all three name
          real accounts this page builds and sends nothing, and there is no treasury balance to read.
        </Empty>
      </Panel>
    )
  }

  if (!address) {
    return (
      <Panel title="Payouts">
        <Empty title="Wallet not connected">
          Connect the treasury wallet from the header. Only the keypair that owns the treasury token
          account can move what is in it.
        </Empty>
      </Panel>
    )
  }

  if (!payouts.isOperator) {
    return (
      <Panel title="Payouts">
        <Empty title="Restricted">
          This desk belongs to{' '}
          <span className="mono">{shortAddress(desk.treasury, 6, 6)}</span>, the wallet that owns the
          treasury token account. Its balance is visible on-chain to anyone; moving it needs that
          wallet's signature and nothing else.
        </Empty>
      </Panel>
    )
  }

  const decimals = payouts.decimals
  const claimable = payouts.claimable

  /** Raw units render as '—' until the mint's decimals are known — a guessed exponent is a wrong number. */
  const amountText = (raw: bigint | null): string =>
    raw === null || decimals === null ? '—' : formatRaw(raw, decimals)

  const inFlight =
    payouts.stage === 'preparing' ||
    payouts.stage === 'awaiting-signature' ||
    payouts.stage === 'confirming'

  const claimDisabled =
    inFlight ||
    !signAndSendTransaction ||
    payouts.claimLocked ||
    claimable === null ||
    claimable <= 0n

  const run = async () => {
    if (!signAndSendTransaction) return
    await payouts.claim(signAndSendTransaction)
  }

  const buttonLabel = () => {
    if (payouts.stage === 'awaiting-signature') return 'Confirm in wallet…'
    if (payouts.stage === 'confirming') return 'Confirming…'
    if (payouts.stage === 'preparing') return 'Preparing…'
    if (payouts.claimLocked) return 'Claim unsettled'
    if (claimable !== null && claimable <= 0n) return 'Nothing to claim'
    return 'Claim treasury'
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Payouts — Operator Treasury"
        right={<span className="keep-case">{shortAddress(address, 4, 4)}</span>}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Claimable"
            value={payouts.balanceLoading && claimable === null ? '…' : amountText(claimable)}
            sub="$xNFT · live from chain"
          />
          <Stat
            label="Claimed"
            value={amountText(payouts.claimedIndexed)}
            sub={payouts.claimedIndexedExact ? 'settled, per the index' : 'per the index · partly unverified'}
          />
          {/* bps over the 10,000 denominator from the spec. Display only — no money is computed here. */}
          <Stat
            label="Fee Rates"
            value={`${desk.tradeFeeBps / 100}% / ${desk.rentFeeBps / 100}%`}
            sub="mint / rental"
          />
          <Stat
            label="Treasury"
            value={<span className="mono text-[11px]">{shortAddress(desk.treasury, 4, 4)}</span>}
            sub="operator-held wallet"
          />
        </div>

        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
          The treasury is an ordinary SPL token account owned by a wallet whose private key the operator
          holds. It is not a program vault: nothing on-chain restricts where its balance can go, and
          whoever holds that key can move these fees anywhere, with or without this page. What the token
          program does enforce is that nobody else can move them at all.
        </p>

        <p className="mt-3 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
          Claimable is the treasury account's balance, read from Solana every time this page refreshes.
          The index below records what was claimed and how it settled; it is never asked what is
          claimable. If the two disagree, the chain is right.
        </p>

        {payouts.treasuryAccount ? (
          <p className="mt-3 text-[10px] text-ink-faint">
            Token account{' '}
            <span className="mono" title={payouts.treasuryAccount}>
              {shortAddress(payouts.treasuryAccount, 8, 8)}
            </span>
          </p>
        ) : null}

        {payouts.balanceError ? (
          <p className="mt-3 text-[10px] text-down">Treasury read failed: {payouts.balanceError}</p>
        ) : null}
      </Panel>

      <Panel
        title="Claim Fees"
        right={payouts.claimLocked ? 'claim unsettled' : payouts.indexed ? 'indexed' : 'index offline'}
      >
        <div className="space-y-3">
          <div className="space-y-1.5 text-[11px]">
            <Row label="Destination">
              <span className="mono text-[10px]" title={desk.devWallet}>
                {shortAddress(desk.devWallet, 6, 6)}
              </span>
            </Row>
            <Row label="Amount">
              <span className="mono tabular-nums">{amountText(claimable)} $xNFT</span>
            </Row>
            <Row label="Signer">
              <span className="mono text-[10px]" title={desk.treasury}>
                {shortAddress(desk.treasury, 6, 6)}
              </span>
            </Row>
          </div>

          <p className="border-t border-rule pt-3 text-[10px] leading-relaxed text-ink-mute">
            Claiming moves the full treasury balance to the dev wallet in a single{' '}
            <span className="mono">transferChecked</span>. The destination is a constant in this client
            and cannot be supplied here — which stops this interface being a drain-anything primitive,
            but is not the same as an on-chain constraint. Read it as an authorization the operator
            performs, not a permission the chain granted.
          </p>

          <p className="text-[10px] leading-relaxed text-ink-faint">
            Fees reach this treasury from mints and rentals, which are real transfers. Sales are ledger
            entries in the index and move no $xNFT, so they accrue nothing here.
          </p>

          {payouts.claimLocked ? (
            <p className="border border-rule p-3 text-[10px] leading-relaxed text-ink-mute">
              A claim from this desk has not settled. Until it confirms or fails, the claimable figure
              above may already have been spent by it, so the button stays shut — a confirmation that
              timed out is unsettled, not failed, and re-signing against a stale balance is how a
              treasury gets paid out twice. A row still marked{' '}
              <span className="keep-case">Unindexed</span> below can be released by hand once you have
              opened its signature and seen for yourself what happened. A row the index holds is the
              backend's to settle, and if it never does, this desk stays shut rather than guessing.
            </p>
          ) : null}

          {!payouts.indexed ? (
            <p className="text-[10px] leading-relaxed text-ink-faint">
              Supabase is not configured, so a claim made here shows as pending in this browser only and
              nothing will ever settle it for you. The transaction is unaffected — the chain is still the
              record.
            </p>
          ) : null}

          {payouts.error ? <p className="text-[10px] text-down">{payouts.error.message}</p> : null}

          {payouts.signature ? (
            <div className="border border-rule p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={payouts.stage === 'confirming' ? 'outline' : 'ink'}>
                  {payouts.stage === 'confirming' ? 'Unconfirmed' : 'Sent'}
                </Chip>
                <span className="mono text-[10px] text-ink-mute" title={payouts.signature}>
                  {shortAddress(payouts.signature, 8, 8)}
                </span>
              </div>
              <a
                href={explorerTx(payouts.signature)}
                target="_blank"
                rel="noreferrer noopener"
                className="mono mt-2 block text-[10px] underline"
              >
                View claim on Solscan →
              </a>
              <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
                This claim is on the wire. It stays pending until the chain confirms it — a read that
                times out leaves it pending rather than marking it failed, because a transaction that may
                have landed must never be presented as retryable.
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={() => void run()} disabled={claimDisabled}>
              {buttonLabel()}
            </Button>
            <button onClick={payouts.refresh} className="text-[10px] text-ink-mute underline">
              Refresh
            </button>
            {payouts.stage === 'done' || payouts.stage === 'error' ? (
              <button onClick={payouts.reset} className="text-[10px] text-ink-faint underline">
                Clear
              </button>
            ) : null}
            {!signAndSendTransaction ? (
              <span className="text-[10px] text-ink-faint">Reconnect your wallet to sign.</span>
            ) : null}
          </div>
        </div>
      </Panel>

      <Panel title="Payout History" right={`${payouts.history.length} claims`} bodyClassName="p-0">
        {payouts.history.length === 0 ? (
          <div className="p-4">
            {payouts.historyLoading ? (
              <Empty title="Loading payouts…">Reading the payout queue.</Empty>
            ) : payouts.historyError ? (
              <Empty title="Payout index unavailable">
                {payouts.historyError}
                <div className="mt-1">
                  Claims still work — the chain does not depend on this index.
                </div>
              </Empty>
            ) : (
              <Empty title="No payouts yet">
                Fees accrue to the treasury on every mint and every rental. Nothing has been claimed from
                it yet.
              </Empty>
            )}
          </div>
        ) : (
          <>
            {/* Also rendered when rows exist, not only in the empty state. A desk
                holding a local claim is never empty, and that is precisely when
                "the index is unreachable" is the sentence explaining why nothing
                is settling and the Claim button has not re-opened. */}
            {payouts.historyError ? (
              <p className="border-b border-rule px-4 py-2 text-[10px] text-down">
                Payout index unavailable: {payouts.historyError}
              </p>
            ) : null}
            <Table>
              <thead>
                <tr>
                  <Th>Requested</Th>
                  <Th align="right">Amount</Th>
                  <Th>Destination</Th>
                  <Th>Status</Th>
                  <Th>Signature</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.history.map((entry, i) => (
                  <Tr key={entry.id} index={i}>
                    <Td className="whitespace-nowrap text-ink-mute">
                      {entry.requestedAt ? dateTime(entry.requestedAt) : '—'}
                    </Td>
                    <Td align="right">
                      <span className="tabular-nums">{amountText(entry.amount)}</span>
                      {/* An amount nobody has read back off the chain is marked as such,
                          rather than sitting in the same column looking settled. */}
                      {!entry.amountVerified && entry.status === 'confirmed' ? (
                        <span
                          className="ml-1 text-ink-faint"
                          title="Requested amount. confirm-payout has not read the settled transfer back yet."
                        >
                          ?
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-ink-faint" title={entry.destination}>
                      {entry.destination ? shortAddress(entry.destination, 6, 6) : '—'}
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <StatusChip status={entry.status} />
                        {entry.status === 'pending' && entry.requestedAt ? (
                          <span className="mono tabular-nums text-[10px] text-ink-faint">
                            {duration(Math.max(0, now - entry.requestedAt))}
                          </span>
                        ) : null}
                        {entry.local ? (
                          <>
                            <Chip tone="mute" title="Held in this browser until the indexer picks it up">
                              Unindexed
                            </Chip>
                            <ReleaseButton entry={entry} onRelease={payouts.release} />
                          </>
                        ) : null}
                      </span>
                    </Td>
                    <Td>
                      {entry.signature ? (
                        <a
                          href={explorerTx(entry.signature)}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mono text-[10px] underline"
                          title={entry.signature}
                        >
                          {shortAddress(entry.signature, 6, 6)} →
                        </a>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Panel>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-faint">{label}</span>
      {children}
    </div>
  )
}

/**
 * Drops a browser-held claim, which re-opens the Claim button.
 *
 * The title spells out what it does and does not do, because this control's only
 * effect is to permit another claim. It changes nothing on-chain and settles
 * nothing — the operator is asserting they have looked the signature up and know
 * what happened to it.
 */
function ReleaseButton({
  entry,
  onRelease,
}: {
  entry: PayoutEntry
  onRelease: (signature: string) => void
}) {
  // Bound to a const so the closure keeps the narrowing the guard just proved.
  const signature = entry.signature
  if (!signature) return null
  return (
    <button
      onClick={() => onRelease(signature)}
      className="text-[10px] text-ink-faint underline"
      title="Stop holding this claim in this browser. Nothing on-chain changes; the Claim button re-opens. Check the signature on an explorer first."
    >
      Release
    </button>
  )
}

/**
 * ui.tsx's Chip has three monochrome tones and no danger tone, and this track does
 * not own that file. Failed borrows Chip's geometry with the `down` token instead:
 * colour earns its place here, because a failed payout that reads like a neutral
 * chip invites a re-claim of money that never moved.
 */
function StatusChip({ status }: { status: PayoutStatus }) {
  if (status === 'failed') {
    return (
      <span className="ui ui-10 inline-block border border-down px-1.5 py-1 text-down">Failed</span>
    )
  }
  return (
    <Chip tone={status === 'confirmed' ? 'ink' : 'outline'}>
      {status === 'confirmed' ? 'Confirmed' : 'Pending'}
    </Chip>
  )
}
