// Earnings — what a connected wallet can ask to be paid, and the queue it asks
// through.
//
// The figure is derived, never invented. It is the same accrued yield the
// Portfolio page shows, summed over the crew the wallet actually holds, then
// netted against payout requests already in the queue. Every function here is a
// function of (crew, now, requests) and nothing else, so two people looking at
// the same wallet at the same instant see the same number.
//
// NOT A BALANCE. Nothing here is raw units, because nothing here gates a
// transfer: a payout request is a support ticket that a person settles by
// sending SOL out of band. The bigint discipline lives in lib/spl.ts, where
// value actually moves. If a payout ever becomes an automatic on-chain claim,
// the amount has to be re-expressed in lamports before it goes anywhere near a
// transaction — a double must not decide how much SOL leaves a wallet.
import { accruedTotal } from './accrual'
import { num } from './format'
import type { Xployee } from './xployee'

/* ---- Rates and thresholds ---------------------------------------------- */

/**
 * SOL/USD when the price feed cannot be reached.
 *
 * This WAS the only source — a hardcoded 180, labelled a placeholder, rendered
 * to the visitor as "at $180 / SOL". Live SOL was $74.81 when that was caught,
 * so the payout page overstated the rate 2.4x and understated every payout by
 * the same factor. lib/prices.ts now reads SOL from the same Jupiter call it
 * already makes for the xStocks, and the live rate is threaded in below.
 *
 * Re-exported from prices.ts rather than restated, so there is one fallback in
 * the codebase and not two that can drift.
 */
export { SOL_USD_FALLBACK } from './prices'
import { SOL_USD_FALLBACK } from './prices'

/** @deprecated Pass the live rate from `usePrices().solUsd`. */
export const SOL_USD = SOL_USD_FALLBACK

/**
 * Smallest payout worth queueing, in USD. A payout is a human sending SOL and
 * paying a network fee to do it; under a cent there is nothing to send and the
 * request would cost more to settle than it is worth.
 */
export const MIN_REQUEST_USD = 0.01

/* ---- Conversion --------------------------------------------------------- */

/**
 * The rate is a parameter with a fallback default, not a constant.
 *
 * A default keeps every existing caller working and keeps a dead price feed
 * from rendering NaN; passing the live rate is what makes the figure true. The
 * guard on the rate itself matters as much as the one on the amount — a feed
 * returning 0 or NaN would otherwise turn a payout into Infinity.
 */
export function usdToSol(usd: number, solUsd: number = SOL_USD_FALLBACK): number {
  const rate = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : SOL_USD_FALLBACK
  if (!Number.isFinite(usd) || rate <= 0) return 0
  return usd / rate
}

export function solToUsd(sol: number, solUsd: number = SOL_USD_FALLBACK): number {
  const rate = Number.isFinite(solUsd) && solUsd > 0 ? solUsd : SOL_USD_FALLBACK
  if (!Number.isFinite(sol)) return 0
  return sol * rate
}

/** SOL amounts for display. Four decimals: a typical payout is ~0.07 SOL. */
export function formatSol(sol: number, decimals = 4): string {
  return `${num(sol, decimals)} SOL`
}

/**
 * Snap a USD figure to cents. Used only when a request is written down — the
 * live readouts stay unrounded so they visibly accrue.
 */
export function roundCents(usd: number): number {
  if (!Number.isFinite(usd)) return 0
  return Math.round(usd * 100) / 100
}

/* ---- The earnings figure ------------------------------------------------ */

export type RequestStatus = 'pending' | 'paid' | 'rejected'

export interface PaymentRequest {
  /** Claim ID — the string a support ticket is resolved by. */
  id: string
  /** The wallet that asked. Stored on the record as well as in the key, so an exported row stands alone. */
  address: string
  amountUsd: number
  amountSol: number
  requestedAt: number
  /**
   * Only ever 'pending' when written here — nothing in this app settles a
   * payout. 'paid' and 'rejected' exist because an operator resolves the ticket
   * elsewhere, and the history table has to be able to render that outcome.
   */
  status: RequestStatus
}

export interface Earnings {
  /** Yield accrued across the crew since each hire, in USD. Monotonic in `now`. */
  accruedUsd: number
  /** Already spoken for by requests that have not been rejected. */
  requestedUsd: number
  /** What the wallet can ask for right now. Never negative. */
  claimableUsd: number
  /** The same figure at the SOL rate passed in — live when the feed is up. */
  claimableSol: number
  /** How many xployees the figure is derived from — shown so the number is traceable. */
  crewSize: number
}

/** Total yield the crew has produced since hire. Zero for an empty wallet. */
export function accruedUsd(xployees: Xployee[], now: number): number {
  return xployees.reduce((sum, x) => sum + accruedTotal(x, now), 0)
}

/**
 * USD already claimed against. A rejected request releases its amount back —
 * anything else, pending or paid, is money the wallet has already asked for.
 */
export function requestedUsd(requests: PaymentRequest[]): number {
  return requests.reduce((sum, r) => (r.status === 'rejected' ? sum : sum + r.amountUsd), 0)
}

export function earningsFor(
  xployees: Xployee[],
  now: number,
  requests: PaymentRequest[] = [],
  solUsd: number = SOL_USD_FALLBACK,
): Earnings {
  const accrued = accruedUsd(xployees, now)
  const spoken = requestedUsd(requests)
  // Clamped rather than allowed to go negative: an operator can reject a request
  // after the fact, and a wallet that over-asked owes nothing — it just waits.
  const claimableUsd = Math.max(0, accrued - spoken)
  return {
    accruedUsd: accrued,
    requestedUsd: spoken,
    claimableUsd,
    claimableSol: usdToSol(claimableUsd, solUsd),
    crewSize: xployees.length,
  }
}

/** Whether the request button should be live. */
export function canRequest(earnings: Earnings): boolean {
  return earnings.claimableUsd >= MIN_REQUEST_USD
}

/* ---- Claim IDs ---------------------------------------------------------- */

/**
 * Crockford's base32: the digits plus 22 letters, with I, L, O and U removed.
 *
 * The removals are the whole point. A claim ID gets read down a phone line,
 * retyped from a screenshot, and pasted into a ticket, so 1/I/l and 0/O must not
 * both be drawable; U is dropped so a random draw cannot spell something an
 * operator would rather not say out loud.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Prefixed so a bare ID is recognisable as ours in a support inbox. */
export const CLAIM_ID_PREFIX = 'XN'

/** `XN-A3K7M-9PQR2` */
export const CLAIM_ID_RE = /^XN-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/

/**
 * A fresh claim ID.
 *
 * Ten symbols of Crockford base32 is 50 bits — around 1.1e15 possibilities, so
 * a million claims collide with probability under 0.05%. That is the right trade
 * for something a human reads aloud: a UUID would be collision-proof and
 * unreadable, and a sequential counter would be readable and would leak how many
 * requests exist while colliding across two browsers that never sync.
 *
 * `crypto.getRandomValues` rather than `Math.random`, which is not seeded for
 * unpredictability and is banned in this codebase besides. Masking a uniform
 * byte to its low 5 bits is unbiased because 256 is a whole multiple of 32.
 */
export function newClaimId(): string {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let body = ''
  for (let i = 0; i < bytes.length; i++) body += ALPHABET[bytes[i] & 31]
  return `${CLAIM_ID_PREFIX}-${body.slice(0, 5)}-${body.slice(5)}`
}

export function isClaimId(value: unknown): value is string {
  return typeof value === 'string' && CLAIM_ID_RE.test(value)
}

/** The record a request writes down: the amount as quoted at the moment of asking. */
export function createRequest(address: string, earnings: Earnings, now: number): PaymentRequest {
  // Snapped to cents here and nowhere else. A ticket has to name one amount, and
  // it must be the amount the visitor saw — not a figure that kept accruing
  // between the click and the write.
  const amountUsd = roundCents(earnings.claimableUsd)
  return {
    id: newClaimId(),
    address,
    amountUsd,
    amountSol: usdToSol(amountUsd),
    requestedAt: now,
    status: 'pending',
  }
}

/* ---- Persistence -------------------------------------------------------- */
//
// THE SEAM. Everything below is the only part of the payout flow that touches
// storage, and it is deliberately four functions wide: load, save, clear,
// subscribe. Repointing payouts at Supabase means reimplementing these four
// against the client and changing nothing in Payments.tsx or EarningsPill.tsx.
//
// It is localStorage today because lib/supabase.ts is being rewritten under a
// separate workflow and coupling to a moving target would be worse than a
// browser-local queue. Same shape as useHoldings.ts and profile.ts: keyed per
// address, and every touch wrapped so a corrupt entry, a full quota or a browser
// with storage switched off degrades to "no history" rather than a blank page.

/** Namespaced per address so switching wallets switches queues. */
function keyFor(address: string): string {
  return `xnfts:payments:${address}`
}

function coerce(value: unknown): PaymentRequest | null {
  if (typeof value !== 'object' || value === null) return null
  const raw = value as Partial<PaymentRequest>
  if (!isClaimId(raw.id)) return null
  if (typeof raw.amountUsd !== 'number' || !Number.isFinite(raw.amountUsd)) return null
  if (typeof raw.requestedAt !== 'number' || !Number.isFinite(raw.requestedAt)) return null
  const status: RequestStatus =
    raw.status === 'paid' || raw.status === 'rejected' ? raw.status : 'pending'
  return {
    id: raw.id,
    address: typeof raw.address === 'string' ? raw.address : '',
    amountUsd: raw.amountUsd,
    // Recomputed rather than trusted: a hand-edited entry must not be able to
    // claim a SOL figure its USD figure does not support.
    amountSol: usdToSol(raw.amountUsd),
    requestedAt: raw.requestedAt,
    status,
  }
}

/** Newest first. */
export function loadRequests(address: string): PaymentRequest[] {
  if (!address) return []
  try {
    const raw = localStorage.getItem(keyFor(address))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(coerce)
      .filter((r): r is PaymentRequest => r !== null)
      .sort((a, b) => b.requestedAt - a.requestedAt)
  } catch {
    // Corrupt storage shouldn't take the page down.
    return []
  }
}

/**
 * Appends one request and returns the resulting history.
 *
 * Re-reads before writing rather than trusting a value held in React state: two
 * tabs on the same wallet would otherwise have the second one overwrite the
 * first one's ticket, and a lost claim ID is a support case nobody can resolve.
 */
export function saveRequest(address: string, request: PaymentRequest): PaymentRequest[] {
  if (!address) return []
  const updated = [request, ...loadRequests(address)]
  try {
    localStorage.setItem(keyFor(address), JSON.stringify(updated))
  } catch {
    // Quota or private mode — the request just won't survive a reload. The claim
    // ID is already on screen, which is the part that matters to the visitor.
  }
  notify()
  return updated
}

export function clearRequests(address: string): void {
  if (!address) return
  try {
    localStorage.removeItem(keyFor(address))
  } catch {
    // Nothing to reconcile — there is no state left either way.
  }
  notify()
}

const listeners = new Set<() => void>()

/**
 * Notifies on write. The header pill and the Payments page render the same
 * queue from two different places in the tree; without this the pill would keep
 * showing a figure the page has already spent, until the next tick happened to
 * re-read it.
 */
export function subscribeRequests(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}
