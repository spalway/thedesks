import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Panel, Table, Th, Td, Tr, Chip, Button } from '../components/ui'
import { collection } from '../lib/collection'
import { listings } from '../lib/market'
import { EPOCH_MS, GENESIS, epochAt } from '../lib/accrual'
import { yieldPerEpoch } from '../lib/accrual'
import { serial } from '../lib/xployee'
import { useNow } from '../lib/useNow'
import { rngFrom } from '../lib/rng'
import { dateTime, num, usd, xnft, shortAddress, plural } from '../lib/format'

type EventKind = 'hire' | 'settle' | 'list' | 'contract'

interface LedgerEvent {
  epoch: number
  at: number
  kind: EventKind
  xployeeId: number
  detail: string
  amount?: string
  mint: string
}

const PAGE = 60

/**
 * The epoch ledger, derived from the same deterministic collection — every row
 * traces back to a real xployee rather than being invented independently.
 */
function buildLedger(now: number): LedgerEvent[] {
  const events: LedgerEvent[] = []
  const all = collection()

  for (const x of all) {
    events.push({
      epoch: epochAt(x.hiredAt),
      at: x.hiredAt,
      kind: 'hire',
      xployeeId: x.id,
      detail: `${x.tier.label} hired · ${x.skills.length} desk${x.skills.length > 1 ? 's' : ''} opened`,
      amount: usd(x.principal, 0),
      mint: x.mint,
    })
  }

  for (const l of listings()) {
    const rng = rngFrom('listevent', l.xployee.mint)
    const at = l.listedAt + Math.floor(rng() * 40) * EPOCH_MS
    if (at > now) continue
    events.push({
      epoch: epochAt(at),
      at,
      kind: l.kind === 'sale' ? 'list' : 'contract',
      xployeeId: l.xployee.id,
      detail:
        l.kind === 'sale'
          ? 'Listed for sale'
          : `Contract opened · ${l.term} epochs @ ${xnft(l.feePerEpoch)}/ep`,
      // The ledger records what the counterparty received, not what the payer
      // was debited — the fee is a separate movement into the treasury.
      amount: l.kind === 'sale' ? xnft(l.price) : xnft(l.feePerEpoch * l.term),
      mint: l.xployee.mint,
    })
  }

  // Settlement rows for recent epochs — one per epoch, aggregated.
  const currentEpoch = epochAt(now)
  for (let e = Math.max(0, currentEpoch - 30); e <= currentEpoch; e++) {
    const at = GENESIS + e * EPOCH_MS
    // Strictly before, not on or before. An epoch pays for work already done,
    // so a worker hired at the instant the epoch opens has not earned it yet.
    // With the whole crew hired at genesis this printed a settlement sitting on
    // the same timestamp as the hire, paying a full epoch for zero elapsed time.
    const active = all.filter((x) => x.hiredAt < at)
    if (active.length === 0) continue
    const paid = active.reduce((s, x) => s + yieldPerEpoch(x), 0)
    events.push({
      epoch: e,
      at,
      kind: 'settle',
      xployeeId: -1,
      detail: `Epoch settled · ${plural(active.length, 'xployee')} paid`,
      amount: usd(paid, 2),
      mint: '',
    })
  }

  return events.filter((e) => e.at <= now).sort((a, b) => b.at - a.at)
}

const KIND_LABEL: Record<EventKind, string> = {
  hire: 'Hire',
  settle: 'Settle',
  list: 'List',
  contract: 'Contract',
}

export function Transactions() {
  const now = useNow(10_000)
  const [filter, setFilter] = useState<EventKind | 'all'>('all')
  const [limit, setLimit] = useState(PAGE)

  const ledger = useMemo(() => buildLedger(now), [now])
  const filtered = filter === 'all' ? ledger : ledger.filter((e) => e.kind === filter)
  const visible = filtered.slice(0, limit)

  return (
    <div className="space-y-4">
      <Panel title="Transactions — Epoch Ledger" right={`${num(filtered.length)} events`}>
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'hire', 'settle', 'list', 'contract'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setFilter(k)
                setLimit(PAGE)
              }}
              className={`ui ui-10 min-h-11 border-2 border-ink px-3 py-1.5 ${
                filter === k ? 'bg-ink text-paper' : 'bg-paper hover:bg-wash'
              }`}
            >
              {k === 'all' ? 'All' : KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          Every row derives from the same deterministic workforce — hires, settlements, and listings all
          trace back to a specific xployee and epoch.
        </p>
      </Panel>

      <Panel title="Ledger" right={`epoch ${epochAt(now)}`} bodyClassName="p-0">
        <Table>
          <thead>
            <tr>
              <Th align="right">Epoch</Th>
              <Th>Time</Th>
              <Th>Event</Th>
              <Th>xployee</Th>
              <Th>Detail</Th>
              <Th>Mint</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e, i) => (
              <Tr key={`${e.kind}-${e.xployeeId}-${e.at}-${i}`} index={i}>
                <Td align="right" className="ui ui-10">
                  {e.epoch}
                </Td>
                <Td className="whitespace-nowrap text-ink-mute">{dateTime(e.at)}</Td>
                <Td>
                  <Chip tone={e.kind === 'settle' ? 'ink' : 'outline'}>{KIND_LABEL[e.kind]}</Chip>
                </Td>
                <Td>
                  {e.xployeeId >= 0 ? (
                    <Link to={`/xployee/${e.xployeeId}`} className="ui ui-10 hover:underline">
                      {serial(e.xployeeId)}
                    </Link>
                  ) : (
                    <span className="text-ink-faint">protocol</span>
                  )}
                </Td>
                <Td className="text-ink-mute">{e.detail}</Td>
                <Td className="text-ink-faint" title={e.mint}>
                  {e.mint ? shortAddress(e.mint) : '—'}
                </Td>
                <Td align="right">{e.amount ?? '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      {limit < filtered.length ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Load more ({num(filtered.length - limit)} left)
          </Button>
        </div>
      ) : null}
    </div>
  )
}
