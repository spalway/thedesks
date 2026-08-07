import { Link } from 'react-router-dom'
import { Panel, Stat, TierBadge, Table, Th, Td, Tr, Empty, LinkButton, Button, Chip } from '../components/ui'
import { XployeeArt } from '../components/XployeeArt'
import { XBossBadge } from '../components/XBossBadge'
import { useHoldings } from '../lib/useHoldings'
import { useWallet } from '../lib/wallet'
import { accruedTotal, bookValue, trailingApy, yieldPerEpoch } from '../lib/accrual'
import { xBossFor, nextRank } from '../lib/network'
import { useNow } from '../lib/useNow'
import { serial } from '../lib/xployee'
import { num, pct, usd, usdLive, shortAddress } from '../lib/format'

export function Portfolio() {
  const { address } = useWallet()
  const holdings = useHoldings()
  const now = useNow(1000)

  if (!address) {
    return (
      <Panel title="Portfolio">
        <Empty title="Wallet not connected">
          Connect a Solana wallet from the header to see your crew. Connection is read-only.
        </Empty>
      </Panel>
    )
  }

  if (holdings.count === 0) {
    return (
      <Panel title="Portfolio" right={<span className="keep-case">{shortAddress(address)}</span>}>
        <Empty title="You haven't hired anyone yet">
          <div className="mt-4">
            <LinkButton to="/mint">Hire your first xployee →</LinkButton>
          </div>
        </Empty>
      </Panel>
    )
  }

  const totalBook = holdings.xployees.reduce((s, x) => s + bookValue(x, now), 0)
  const totalAccrued = holdings.xployees.reduce((s, x) => s + accruedTotal(x, now), 0)
  const perEpoch = holdings.xployees.reduce((s, x) => s + yieldPerEpoch(x), 0)
  const avgApy = holdings.xployees.reduce((s, x) => s + x.apy, 0) / holdings.count

  const rank = xBossFor(totalBook)
  const next = nextRank(totalBook)

  return (
    <div className="space-y-5">
      <Panel title="Portfolio — Your Crew" right={<span className="keep-case">{shortAddress(address)}</span>}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="xployees" value={num(holdings.count)} sub="hired by you" />
          <Stat label="Book Value" value={usd(totalBook)} sub="principal + accrued" />
          <Stat
            label="Unclaimed"
            value={<span className="tabular-nums">{usdLive(totalAccrued)}</span>}
            sub="accruing live"
          />
          <Stat label="Per Epoch" value={usd(perEpoch, 3)} sub={`${pct(avgApy)} avg APY`} />
          <Stat
            label="xBoss"
            value={<XBossBadge rank={rank} size="lg" />}
            sub={
              next
                ? `${usd(next.remaining, 0)} of book to reach ${next.rank}`
                : 'Top of the ladder'
            }
          />
        </div>
      </Panel>

      <Panel title="Your xployees" bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th>xployee</Th>
              <Th>Tier</Th>
              <Th>Desks</Th>
              <Th align="right">APY</Th>
              <Th align="right">Trailing</Th>
              <Th align="right">Book</Th>
              <Th align="right">Unclaimed</Th>
              <Th align="right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {holdings.xployees.map((x, i) => {
              const trailing = trailingApy(x, now)
              return (
                <Tr key={x.id} index={i}>
                  <Td>
                    {/* min-h-11: the 32px art was setting the link height, which
                        left the row's main target at 38px. */}
                    <Link to={`/xployee/${x.id}`} className="flex min-h-11 items-center gap-2.5 hover:underline">
                      <XployeeArt xployee={x} size={32} animated={false} className="" />
                      <span className="ui ui-10">{serial(x.id)}</span>
                    </Link>
                  </Td>
                  <Td>
                    <TierBadge tier={x.tier} />
                  </Td>
                  <Td className="text-[10px] text-ink-mute">{x.skills.map((h) => h.skill.desk).join(' · ')}</Td>
                  <Td align="right">{pct(x.apy, 1)}</Td>
                  <Td align="right">
                    <span className="flex items-center justify-end gap-1.5">
                      {pct(trailing.rate, 1)}
                      {trailing.estimated ? <Chip tone="mute">Est</Chip> : null}
                    </span>
                  </Td>
                  <Td align="right">{usd(bookValue(x, now))}</Td>
                  <Td align="right" className="tabular-nums">
                    {usdLive(accruedTotal(x, now))}
                  </Td>
                  {/* p-0 on the cell so the link can be the full row height —
                      44px of target instead of 25px, without the cell's own
                      padding stacking on top of it. */}
                  <Td align="right" className="p-0">
                    <Link
                      to={`/xployee/${x.id}`}
                      className="ui ui-10 flex min-h-11 items-center justify-end px-3 hover:bg-ink hover:text-paper"
                    >
                      Manage
                    </Link>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Local Data">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-[10px] leading-relaxed text-ink-faint">
            Your hires are stored in this browser only — there is no account and no server. Clearing them
            removes your simulated crew; the wallets on xNET are unaffected.
          </p>
          <Button variant="outline" onClick={holdings.clear}>
            Clear my hires
          </Button>
        </div>
      </Panel>
    </div>
  )
}
