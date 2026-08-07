import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Panel, Stat, TierBadge, Button, Table, Th, Td, Tr, Chip, LinkButton } from '../components/ui'
import { XployeeArt } from '../components/XployeeArt'
import { buildXployee, serial, principalFor, type Xployee } from '../lib/xployee'
import { TIERS } from '../lib/tiers'
import { useHoldings } from '../lib/useHoldings'
import { useWallet } from '../lib/wallet'
import { HIRED_COUNT, SUPPLY } from '../lib/collection'
import { effectiveApy } from '../lib/skills'
import { usePrices } from '../lib/usePrices'
import { num, pct, usd } from '../lib/format'
// @solana/web3.js + spl-token are ~320kB and only ever needed here, at the
// moment someone actually burns. Lazy-loading keeps them out of the main chunk
// so every other page still loads on the small bundle.
const BurnGate = lazy(() =>
  import('../components/BurnGate').then((m) => ({ default: m.BurnGate })),
)

type Phase = 'idle' | 'rolling' | 'revealed'

/** Preview ids sit far past the collection so they never collide with real serials. */
const PREVIEW_BASE = 90_000

const ROLL_STEPS = 26

/**
 * The roll decelerates rather than running at a fixed rate — a flat cycle reads
 * as a loading spinner, while a slowdown reads as a result landing.
 *
 * Normalised on step/ROLL_STEPS so the curve's shape is independent of the step
 * count: an un-normalised power curve blew the total out to ~12s.
 * This sums to roughly 3s, ending at ~340ms between swaps.
 */
function rollDelay(step: number): number {
  return Math.round(42 + Math.pow(step / ROLL_STEPS, 3) * 300)
}

export function Mint() {
  const { address } = useWallet()
  const holdings = useHoldings()
  const prices = usePrices()

  const [phase, setPhase] = useState<Phase>('idle')
  const [hired, setHired] = useState<Xployee | null>(null)
  const [preview, setPreview] = useState<Xployee>(() => buildXployee(PREVIEW_BASE + 1, Date.now()))
  const [flash, setFlash] = useState(false)
  const [deskCount, setDeskCount] = useState(0)

  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  const shown = phase === 'revealed' && hired ? hired : preview

  function startHire() {
    if (!address || phase === 'rolling') return
    setPhase('rolling')
    setHired(null)
    setDeskCount(0)

    // Schedule the whole decelerating sequence up front; each tick swaps the
    // candidate so the art and its background both cycle.
    let elapsed = 0
    for (let step = 0; step < ROLL_STEPS; step++) {
      elapsed += rollDelay(step)
      const id = window.setTimeout(() => {
        setPreview(buildXployee(PREVIEW_BASE + ((step * 37) % 971) + 1, Date.now()))
      }, elapsed)
      timers.current.push(id)
    }

    const settle = window.setTimeout(() => {
      const x = holdings.hire()
      setHired(x)
      setPhase('revealed')
      setFlash(true)
      timers.current.push(window.setTimeout(() => setFlash(false), 550))
      // Desks tick in one at a time so a 4-skill X-RATED lands with weight.
      x.skills.forEach((_, i) => {
        timers.current.push(window.setTimeout(() => setDeskCount(i + 1), 260 * (i + 1)))
      })
    }, elapsed + 260)
    timers.current.push(settle)
  }

  function reset() {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setPhase('idle')
    setHired(null)
    setDeskCount(0)
  }

  const remaining = SUPPLY.max - HIRED_COUNT - holdings.count

  return (
    <div className="space-y-5">
      <Panel title="Mint — Hire An xployee" right={`${num(remaining)} positions open`}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Supply" value={`${num(HIRED_COUNT + holdings.count)} / ${num(SUPPLY.max)}`} sub="hired" />
          <Stat label="Entry Price" value={usd(principalFor(TIERS[0]), 0)} sub="1-skill floor" />
          <Stat label="Top Price" value={usd(principalFor(TIERS[3]), 0)} sub="4-skill X-RATED" />
          <Stat label="Your Hires" value={num(holdings.count)} sub="this wallet" />
        </div>
        <p className="mt-4 max-w-3xl text-[11px] leading-relaxed text-ink-mute">
          You don't pick a portfolio — you hire a worker, and its tier decides how many desks it can staff.
          Capital deployed scales with skill count, so a four-skill X-RATED costs four times an uncommon
          hire and works four desks from day one.
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <Panel title={phase === 'revealed' ? 'Hired' : phase === 'rolling' ? 'Interviewing' : 'Candidate'} bodyClassName="p-0">
          <div className="relative">
            <XployeeArt
              xployee={shown}
              size={416}
              className={`w-full border-b border-ink transition-transform duration-300 ${
                phase === 'revealed' ? 'scale-100' : ''
              }`}
            />

            {/* Reveal flash, tinted by the tier that landed. */}
            {flash && hired ? (
              <div
                className="pointer-events-none absolute inset-0 animate-pulse"
                style={{ background: hired.tier.color, opacity: 0.28 }}
              />
            ) : null}

            {phase === 'rolling' ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
                <span className="ui ui-10 bg-ink px-3 py-1.5 text-paper">Interviewing…</span>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 p-4">
            {phase === 'revealed' && hired ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="ui ui-18">{serial(hired.id)}</span>
                  <TierBadge tier={hired.tier} size="lg" />
                </div>
                <div className="flex flex-wrap gap-3">
                  <LinkButton to={`/xployee/${hired.id}`}>View sheet →</LinkButton>
                  <Button variant="outline" onClick={reset}>
                    Hire another
                  </Button>
                </div>
              </>
            ) : !address ? (
              <div className="space-y-2">
                <div className="ui ui-12 text-ink-mute">Wallet required</div>
                <p className="text-[11px] leading-relaxed text-ink-faint">
                  Connect a Solana wallet from the header to hire. Connecting is read-only; nothing is
                  signed until you click the mint button yourself, and the cost is on screen before you do.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Suspense
                  fallback={
                    <div className="border border-rule p-4 text-[10px] text-ink-faint">
                      Loading mint module…
                    </div>
                  }
                >
                  {/* The simulated hire is handed to BurnGate rather than rendered
                      beside it, because BurnGate is the only thing here that knows
                      whether the real charge is armed — and it renders this only
                      while it is not. A free hire sitting next to a live 10,000
                      $xNFT burn button offers two buttons that look alike and cost
                      wildly different things. */}
                  <BurnGate
                    onBurned={startHire}
                    simulatedFallback={
                      <Button onClick={startHire} disabled={phase === 'rolling'} className="w-full">
                        {phase === 'rolling' ? 'Interviewing…' : 'Hire xployee (simulated)'}
                      </Button>
                    }
                  />
                </Suspense>
                <p className="text-[10px] leading-relaxed text-ink-faint">
                  What the charge buys is a local record. Once the mint is configured the $xNFT debit is a
                  real transfer, but the xployee it reveals is generated in your browser and stored there —
                  there is no NFT on-chain to receive.
                </p>
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel
            title={phase === 'revealed' ? 'Assigned Desks' : 'Tier Table'}
            right={phase === 'revealed' && hired ? `${deskCount} of ${hired.skills.length}` : undefined}
          >
            {phase === 'revealed' && hired ? (
              <Table>
                <thead>
                  <tr>
                    <Th>Skill</Th>
                    <Th>Desk</Th>
                    <Th>Ticker</Th>
                    <Th align="right">Price</Th>
                    <Th align="right">Prof.</Th>
                    <Th align="right">Eff. APY</Th>
                  </tr>
                </thead>
                <tbody>
                  {hired.skills.slice(0, deskCount).map((h, i) => (
                    <Tr key={h.skill.id} index={i}>
                      <Td>
                        <span className="ui ui-10">{h.skill.label}</span>
                      </Td>
                      <Td className="text-ink-mute">{h.skill.desk}</Td>
                      <Td>
                        <span className="mono keep-case font-medium">${h.skill.ticker}</span>
                      </Td>
                      <Td align="right">{usd(prices.bySymbol[h.skill.ticker])}</Td>
                      <Td align="right">{pct(h.proficiency, 0)}</Td>
                      <Td align="right">{pct(effectiveApy(h))}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Tier</Th>
                    <Th align="right">Skills</Th>
                    <Th align="right">Odds</Th>
                    <Th align="right">Price</Th>
                    <Th>Background</Th>
                  </tr>
                </thead>
                <tbody>
                  {TIERS.map((t, i) => (
                    <Tr key={t.id} index={i}>
                      <Td>
                        <TierBadge tier={t} />
                      </Td>
                      <Td align="right">{t.skills}</Td>
                      <Td align="right">{pct(t.supply, 0)}</Td>
                      <Td align="right">{usd(principalFor(t), 0)}</Td>
                      <Td className="text-ink-mute">
                        {t.id === 'entry'
                          ? 'Flat neutral'
                          : t.id === 'mid'
                            ? 'Vivid solid'
                            : t.id === 'expert'
                              ? 'Spacial rays'
                              : 'Scenic, weathered'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>

          {holdings.count > 0 ? (
            <Panel title="Your Hires" right={num(holdings.count)}>
              <div className="flex flex-wrap gap-3">
                {holdings.xployees
                  .slice(-12)
                  .reverse()
                  .map((x) => (
                    <Link key={x.id} to={`/xployee/${x.id}`} title={serial(x.id)}>
                      <XployeeArt xployee={x} size={64} animated={false} className="" />
                      <span className="ui ui-10 mt-1 block text-ink-mute">{serial(x.id)}</span>
                    </Link>
                  ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <LinkButton to="/portfolio">Manage portfolio →</LinkButton>
                <Chip tone="mute">Stored locally</Chip>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  )
}
