import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, Stat, Table, Th, Td, Tr, Empty, Heading } from '../components/ui'
import { MINT_BURN } from '../lib/fees'
import { MAX_SUPPLY } from '../lib/xployee'
import {
  PLANNED_SUPPLY,
  xnftCa,
  dexScreenerUrl,
  isTokenLaunched,
  pumpFunUrl,
  twitterHandle,
  twitterUrl,
} from '../lib/token'
import { useRuntimeConfig } from '../lib/useRuntimeConfig'
import { num, pct } from '../lib/format'

/**
 * The burn model, derived once at module scope from the fee engine rather than
 * typed out again here. Every figure is a consequence of MINT_BURN in lib/fees.ts
 * and the collection size — restating either would mean this page could disagree
 * with the mint button about what a mint costs.
 *
 * There is no fee line any more. A mint is one transfer and all of it goes to
 * the project wallet, so cost-per-hire and revenue-per-hire are the same number
 * and the treasury takes nothing at mint-out.
 *
 * BURN_SHARE is a historical name for a figure that is no longer a burn: it is
 * the share of supply COLLECTED at full mint-out. Supply does not change.
 *
 * All whole-token bigints. A billion-token supply times a per-mint burn is well
 * inside a double's exact range today, but "well inside" is not a property worth
 * depending on when the arithmetic is this cheap to do exactly.
 */
const SUPPLY_CAP = BigInt(MAX_SUPPLY)
const BURN_AT_MINT_OUT = MINT_BURN * SUPPLY_CAP
/**
 * Share of total supply destroyed if every xployee is hired.
 *
 * The one float on this page, and it only ever prints a percentage. `Number()` on
 * both operands is exact here — 5e7 and 1e9 are far inside 2^53 — and
 * PLANNED_SUPPLY is a non-zero constant, so this cannot divide by zero or reach
 * the page as NaN.
 */
const BURN_SHARE = Number(BURN_AT_MINT_OUT) / Number(PLANNED_SUPPLY)

const whole = (v: bigint) => num(Number(v))

export function Token() {
  // Subscribed: the CA now lives in Supabase, so this page must follow an edit
  // without a reload. useRuntimeConfig also starts the poll.
  useRuntimeConfig()
  const launched = isTokenLaunched()
  const pump = pumpFunUrl()
  const dex = dexScreenerUrl()
  const handle = twitterHandle()

  return (
    <div className="space-y-5">
      {/* Panel titles run through the uppercase label style and take a plain
          string, so the ticker cannot appear here without being flattened to
          $XNFT. The brand keeps its lowercase x in the body copy instead. */}
      {/* `right` as plain text, not a Chip: the panel bar is `bg-ink` and Chip's
          tones are `text-ink` / `bg-ink`, so a chip up here is the same colour as
          the bar it sits on — invisible in both themes. The bar styles its own
          meta slot correctly. */}
      <Panel title="Token — Overview" right={launched ? 'Live' : 'Not launched'}>
        <p className="mb-4 max-w-3xl text-[12px] leading-relaxed">
          <span className="keep-case">$xNFT</span> is the unit every hire, sale and contract in this
          interface is denominated in. It is the only token the protocol uses. Hiring an xployee
          transfers <span className="keep-case">{whole(MINT_BURN)} $xNFT</span> to the project
          wallet, so every hire funds the protocol rather than reducing supply.
        </p>

        <ContractAddress launched={launched} />
      </Panel>

      <Panel title="Supply & Mint Revenue" right="by design">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Total Supply"
            value={<span className="keep-case">{whole(PLANNED_SUPPLY)}</span>}
            sub="fixed at launch, mint authority revoked"
          />
          <Stat
            label="Cost / Hire"
            value={<span className="keep-case">{whole(MINT_BURN)}</span>}
            sub="paid to the project wallet per xployee"
          />
          <Stat
            label="Fee / Hire"
            value={<span className="keep-case">0</span>}
            sub="no protocol fee on top of the price"
          />
          <Stat
            label="Revenue At Mint-Out"
            value={<span className="keep-case">{whole(BURN_AT_MINT_OUT)}</span>}
            sub={`if all ${num(MAX_SUPPLY)} xployees are hired`}
          />
          <Stat
            label="Share Of Supply"
            value={pct(BURN_SHARE, 2)}
            sub="collected if every xployee is hired"
            accent="var(--color-money)"
          />
          <Stat
            label="Collected To Date"
            value={launched ? <span className="keep-case">See DexScreener</span> : '—'}
            sub={
              launched
                ? 'read the wallet on-chain; this page does not'
                : 'nothing has been minted yet'
            }
          />
        </div>

        <p className="mt-4 max-w-3xl text-[10px] leading-relaxed text-ink-faint">
          These are the token's design, not a chain read. This page does not query the network, so
          nothing here is a live circulating or collected figure — once the mint exists, DexScreener
          and any Solana explorer are the authority on what has actually happened.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Distribution">
          <Table>
            <thead>
              <tr>
                <Th>Allocation</Th>
                <Th align="right">Share</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              <Tr index={0}>
                <Td>Public — bonding curve</Td>
                <Td align="right">{pct(1, 2)}</Td>
                <Td className="text-ink-mute">Everything is bought on the open market, team included.</Td>
              </Tr>
              <Tr index={1}>
                <Td>Team, presale, advisors</Td>
                <Td align="right">{pct(0, 2)}</Td>
                <Td className="text-ink-mute">None allocated, so there is nothing to vest or unlock.</Td>
              </Tr>
              <Tr index={2}>
                <Td>Collected by hiring</Td>
                <Td align="right">
                  <span className="text-money">{pct(BURN_SHARE, 2)}</span>
                </Td>
                <Td className="text-ink-mute">
                  At full mint-out. Paid to the project wallet and still in circulation.
                </Td>
              </Tr>
            </tbody>
          </Table>
          <p className="mt-4 text-[10px] leading-relaxed text-ink-faint">
            A pump.fun launch has no allocation to hand out — the supply starts on the curve and the
            market decides who holds it.
          </p>
        </Panel>

        <Panel title="Where The Revenue Comes From">
          <Heading>Hiring funds the protocol</Heading>
          <p className="mb-3 max-w-2xl text-[12px] leading-relaxed">
            One hire is a single transaction with a single leg:{' '}
            <span className="keep-case mono">{whole(MINT_BURN)}</span> to the project wallet. No fee,
            no treasury cut, no second destination. The whole price is protocol revenue.
          </p>
          <p className="mb-3 max-w-2xl text-[12px] leading-relaxed">
            Hired out to the cap, that is{' '}
            <span className="keep-case mono">{whole(BURN_AT_MINT_OUT)} $xNFT</span> collected —{' '}
            {pct(BURN_SHARE, 2)} of every token that will ever exist, paid in by people putting
            xployees to work.
          </p>
          <p className="mb-3 max-w-2xl text-[12px] leading-relaxed">
            <strong>These tokens are not burned.</strong> Supply is fixed at launch and minting does
            not reduce it — every token paid stays in circulation, in a wallet the team controls.
          </p>
          <p className="max-w-2xl text-[10px] leading-relaxed text-ink-faint">
            The payment is real once the token is: it is a transfer to an address the operator sets,
            not a promise in a document. Until the mint exists, nothing has been collected. See{' '}
            <Link to="/docs" className="underline">
              Docs
            </Link>{' '}
            for the full mechanism and disclosure.
          </p>
        </Panel>
      </div>

      <Panel title="Markets">
        {launched && (pump || dex) ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              {pump ? <ExternalButton href={pump}>Buy on pump.fun →</ExternalButton> : null}
              {dex ? <ExternalButton href={dex}>Chart on DexScreener →</ExternalButton> : null}
              {handle ? <ExternalButton href={twitterUrl() ?? ''}>@{handle} →</ExternalButton> : null}
            </div>
            <p className="mt-4 max-w-3xl text-[10px] leading-relaxed text-ink-faint">
              These links leave the app. Always check the contract address above against the one the
              market page shows before you buy anything.
            </p>
          </>
        ) : (
          <Empty title="No market yet">
            {launched ? (
              <>
                The mint exists, but no pump.fun page or DexScreener pair has been recorded yet — a
                pair only appears once there is liquidity. Set the URLs in{' '}
                <span className="mono">lib/token.ts</span> and they show up here.
              </>
            ) : (
              <>
                <span className="keep-case">$xNFT</span> has not launched, so there is no pump.fun page
                and no DexScreener pair to link to. Rather than show buttons that go nowhere, this
                section stays empty until the addresses in <span className="mono">lib/token.ts</span>{' '}
                are set.
              </>
            )}
          </Empty>
        )}
      </Panel>
    </div>
  )
}

/**
 * The CA, or an honest admission that there isn't one.
 *
 * `.mono .keep-case` is not decoration. Base58 is case-sensitive and carries no
 * checksum a human can eyeball, so an address flattened by the global uppercase
 * rule is a different address that looks correct — a bug this codebase has
 * already shipped once.
 */
function ContractAddress({ launched }: { launched: boolean }) {
  if (!launched) {
    return (
      <div className="border border-dashed border-rule px-4 py-6">
        <div className="ui ui-11 text-ink-mute">Contract address — not yet assigned</div>
        <p className="mt-2.5 max-w-2xl text-[11px] leading-relaxed text-ink-faint">
          The token has not launched, so there is no mint address to publish. Nothing here is a
          placeholder you can trade: if a site, a DM or a bot offers you a{' '}
          <span className="keep-case">$xNFT</span> contract address today, it is not ours. The address
          will appear here, and on our X account, the moment it exists.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-ink">
      <div className="flex items-center justify-between gap-4 bg-wash px-3 py-2">
        <span className="ui ui-10 text-ink-mute">Contract address (CA)</span>
        <CopyButton value={xnftCa()} />
      </div>
      <div className="px-3 py-3">
        <code className="mono keep-case block break-all text-[12px] leading-relaxed select-all">
          {xnftCa()}
        </code>
      </div>
    </div>
  )
}

/** Copy with a confirmation. Silence after a click reads as a broken button. */
function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      // The clipboard API is permission-gated and absent over plain http. The
      // address is `select-all` text regardless, so say what to do instead of
      // failing silently.
      setState('failed')
    }
    window.setTimeout(() => setState('idle'), 2_000)
  }

  return (
    <button
      onClick={() => void copy()}
      className="ui ui-10 inline-flex min-h-11 shrink-0 items-center border border-ink px-3 py-1 transition-colors hover:bg-ink hover:text-paper"
    >
      {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Select and copy' : 'Copy'}
    </button>
  )
}

/**
 * An outbound link wearing LinkButton's clothes. LinkButton renders a router
 * <Link>, which is the wrong element for a destination outside the app.
 */
function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="ui ui-11 keep-case inline-flex min-h-11 items-center border border-ink px-4 py-2.5 text-ink transition-colors hover:bg-ink hover:text-paper"
    >
      {children}
    </a>
  )
}
