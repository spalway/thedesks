import { useCallback, useEffect, useState } from 'react'
import { buildXployee, type Xployee } from './xployee'
import { HIRED_COUNT, serialForMint } from './collection'

/**
 * The visitor's own hires, persisted locally.
 *
 * Stored as ids + hire timestamps only — the xployee itself is rebuilt from
 * its id, so a saved holding always regenerates identically.
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

export function useHoldings() {
  const [records, setRecords] = useState<HoldingRecord[]>([])

  useEffect(() => {
    setRecords(read())
  }, [])

  const hire = useCallback((): Xployee => {
    const current = read()
    // Draw the next serial from the reveal order rather than incrementing.
    // Serials carry rarity now, so a counter would hand every new hire an
    // uncommon and make minting pointless.
    const nextId = serialForMint(HIRED_COUNT + current.length)
    const record: HoldingRecord = { id: nextId, hiredAt: Date.now() }
    const updated = [...current, record]
    write(updated)
    setRecords(updated)
    return buildXployee(record.id, record.hiredAt)
  }, [])

  const clear = useCallback(() => {
    write([])
    setRecords([])
  }, [])

  const xployees: Xployee[] = records.map((r) => buildXployee(r.id, r.hiredAt))

  return { xployees, hire, clear, count: records.length }
}
