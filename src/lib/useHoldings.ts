import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { buildXployee, type Xployee } from './xployee'
import { HIRED_COUNT, serialForMint } from './collection'
import { isBackendEnabled, ownership, refreshOwnership, subscribeBackend, xployeeFor } from './db'
import { useWallet } from './wallet'

/**
 * What the connected wallet holds.
 *
 * TWO SOURCES, ONE GATE, and the gate decides which is authoritative.
 *
 * With a backend configured, holdings come from Postgres — `xployees.owner`,
 * written by ingest-signature once a burn is recognised on chain. That is the
 * only version of ownership that can be right: it is the same answer in every
 * browser, it survives clearing site data, and two people minting in the same
 * second cannot both be handed the same serial.
 *
 * Without one, the localStorage store below is all there is, and the mint page
 * is explicit about it — the button reads "Hire xployee (simulated)" while the
 * real charge is unarmed.
 *
 * This used to be localStorage ONLY, with no wallet involved at all: it held a
 * browser's crew rather than a wallet's. Connecting a different wallet showed
 * you the same xployees, clearing site data destroyed them, and the serial a
 * mint assigned came from the local record count — so the first two people ever
 * to mint would both have been issued the serial at position 1.
 */
const KEY = 'xnfts:holdings'

export interface HoldingRecord {
  id: number
  hiredAt: number
}

function read(): HoldingRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (r): r is HoldingRecord =>
        typeof r === 'object' && r !== null && typeof (r as HoldingRecord).id === 'number',
    )
  } catch {
    // Corrupt storage shouldn't take the page down.
    return []
  }
}

function write(records: HoldingRecord[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(records))
  } catch {
    // Quota or private mode — holdings just won't persist.
  }
}

/**
 * A counter that ticks whenever any db.ts snapshot changes.
 *
 * Reads there are split into a synchronous peek and a background refresh, so the
 * first paint after a cold start has no ownership graph and the real answer
 * lands a moment later. Subscribing is what gets that second state onto the
 * screen instead of leaving it until some other clock happens to tick.
 */
let version = 0
subscribeBackend(() => {
  version += 1
})

function useBackendVersion(): number {
  return useSyncExternalStore(
    subscribeBackend,
    () => version,
    () => 0,
  )
}

export function useHoldings() {
  const { address } = useWallet()
  const [records, setRecords] = useState<HoldingRecord[]>([])
  // Subscribed for the repaint; the value itself is never read.
  useBackendVersion()

  useEffect(() => {
    setRecords(read())
  }, [])

  const remote = isBackendEnabled()

  /**
   * The simulated hire. Local path only.
   *
   * With a backend the serial is assigned by `reserve_mint` under an advisory
   * lock, and ownership is written by ingest-signature after the burn is seen on
   * chain. A client picking its own number would be choosing which xployee to
   * own, which is the entire thing the lock exists to prevent.
   */
  const hire = useCallback((): Xployee => {
    const current = read()
    const record: HoldingRecord = {
      id: serialForMint(HIRED_COUNT + current.length),
      hiredAt: Date.now(),
    }
    const updated = [...current, record]
    write(updated)
    setRecords(updated)
    return buildXployee(record.id, record.hiredAt)
  }, [])

  const clear = useCallback(() => {
    write([])
    setRecords([])
  }, [])

  let xployees: Xployee[]
  if (remote) {
    const snapshot = ownership()
    const serials = address && snapshot ? (snapshot.byOwner.get(address) ?? []) : []
    xployees = serials
      .map((id) => xployeeFor(id, snapshot?.hiredAt.get(id) ?? null))
      .filter((x): x is Xployee => Boolean(x))
  } else {
    xployees = records.map((r) => buildXployee(r.id, r.hiredAt))
  }

  return {
    xployees,
    hire,
    clear,
    count: xployees.length,
    /** True when the figures above came from Postgres rather than this browser. */
    authoritative: remote,
    /** Re-read the ownership graph. Call after a mint is recognised. */
    refresh: refreshOwnership,
  }
}
