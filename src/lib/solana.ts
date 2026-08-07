// Burn-to-mint: the $xNFT charge that buys one xployee.
//
// This is an adapter, not a mechanism. It keeps the names, stages and error shape
// the UI already speaks — BURN_ADDRESS, MINT_COST, BurnError, sendBurn — and
// delegates every RPC call and every byte of transaction building to ./spl.
//
// What it delegated to changed underneath it twice. The charge used to route
// through a `mint_xployee` instruction on an Anchor program; that program was
// abandoned before deployment. It then became two `transferChecked` instructions,
// 10,000 to the incinerator and a 500 protocol fee to the treasury. The fee is
// now gone: a mint is ONE transfer of 10,000 $xNFT to the incinerator, and there
// is no second leg, no treasury, and no MINT_FEE or MINT_TOTAL to import. Those
// two constants were deleted rather than set to zero, because a fee constant that
// still exists at zero is a fee waiting for someone to fill it in.
//
// The four rules this module was written under all survived both changes, because
// none of them ever needed the program:
//
//   1. $xNFT does not exist yet. The mint address is an empty placeholder in
//      ./spl and every path that could build or send refuses while it is unset —
//      isBurnConfigured() is the single gate, and it now asks about the mint
//      alone, because the mint is the only address a burn touches.
//   2. The destination is hard-coded. The incinerator is a module constant in
//      ./spl and is not a parameter of anything, here or there.
//   3. Building and sending are separate calls. Nothing here signs on its own;
//      sendBurn runs only from an explicit user action.
//   4. Balance is verified before a transaction is built, and a shortfall comes
//      back as data rather than as a transaction the wallet will reject.
//
// Nothing throws. Every async path resolves to a BurnError the UI can render.
import type { Transaction } from '@solana/web3.js'
import { MINT_BURN } from './fees'
import {
  INCINERATOR_ADDRESS,
  buildMintTransaction,
  fetchOwnerBalance,
  isMintConfigured,
  isSplError,
  sendMint,
  type SplError,
  type TxOptions,
} from './spl'

export { DEFAULT_RPC, xnftMintAddress, getConnection } from './spl'

/**
 * Solana's canonical incinerator. Nobody holds this key, so tokens parked in its
 * token account are gone for good — which is exactly the point.
 *
 * Re-exported from ./spl under the name the UI already prints, so there is one
 * address in the codebase rather than two that have to agree.
 */
export const BURN_ADDRESS = INCINERATOR_ADDRESS

/**
 * Whole $xNFT destroyed per xployee — and, since there is no fee, the entire
 * debit. What a button quotes and what a gate checks a balance against are the
 * same number, because the transaction has one leg.
 *
 * `Number()` is safe on this one and nowhere near a balance: it is a whole-token
 * display figure of 10,000, it never scales by decimals, and every raw-unit
 * amount that reaches a transaction comes from `mintAmount` in ./fees as a
 * bigint.
 */
export const MINT_COST = Number(MINT_BURN)

export type BurnStage = 'idle' | 'checking' | 'awaiting-signature' | 'confirming' | 'done' | 'error'

export interface BurnError {
  code:
    | 'not-configured'
    | 'no-wallet'
    | 'no-token-account'
    | 'insufficient-balance'
    | 'rejected'
    | 'network'
    | 'unknown'
  message: string
  /** Whole $xNFT still needed, when the failure is about balance. */
  shortfall?: number
}

export interface TokenBalance {
  uiAmount: number
  decimals: number
  rawAmount: bigint
  /** False when the owner has never held $xNFT — no associated token account exists. */
  exists: boolean
}

/** Options for a mint. Only the RPC endpoint; nothing about a mint is parameterised. */
export type BurnOptions = TxOptions

const BURN_CODES: ReadonlySet<string> = new Set([
  'not-configured',
  'no-wallet',
  'no-token-account',
  'insufficient-balance',
  'rejected',
  'network',
  'unknown',
])

export function isBurnError(v: unknown): v is BurnError {
  if (typeof v !== 'object' || v === null) return false
  const candidate = v as { code?: unknown; message?: unknown }
  return typeof candidate.code === 'string' && BURN_CODES.has(candidate.code) && typeof candidate.message === 'string'
}

/**
 * False until the $xNFT mint address is set in ./spl.
 *
 * Every burn path checks this first, and it is what keeps the app safe by default
 * while the token does not exist. It used to require the treasury and dev wallet
 * as well, because the fee leg paid the treasury. With the fee gone, a burn
 * touches exactly two addresses — the token and an incinerator nobody can change
 * — so those two are no longer part of the question.
 */
export function isBurnConfigured(): boolean {
  return isMintConfigured()
}

export function explorerTx(signature: string): string {
  return `https://solscan.io/tx/${signature}`
}

/** Exact within a float's range because whole and fractional parts are converted separately. */
function toUiAmount(raw: bigint, decimals: number): number {
  const base = 10n ** BigInt(decimals)
  return Number(raw / base) + Number(raw % base) / Number(base)
}

/**
 * Narrows an SplError to the vocabulary this module's callers already handle.
 *
 * The message always survives untouched — it is the sentence the visitor reads,
 * and ./spl writes a better one than a re-mapped code could. Only the code is
 * coarsened, and the direction that matters is preserved exactly: `rejected`
 * never becomes an error worth retrying automatically. Anything ./spl can only
 * produce on a path this module never takes — `invalid-request`, `not-operator` —
 * falls through to `unknown` rather than being silently renamed into a code the
 * UI would render with the wrong copy.
 */
function toBurnError(error: SplError): BurnError {
  const code: BurnError['code'] =
    error.code === 'not-configured' ||
    error.code === 'no-wallet' ||
    error.code === 'no-token-account' ||
    error.code === 'insufficient-balance' ||
    error.code === 'rejected' ||
    error.code === 'network'
      ? error.code
      : 'unknown'

  if (!error.shortfall) return { code, message: error.message }
  const shortfall = toUiAmount(error.shortfall.raw, error.shortfall.decimals)
  // Restated in whole tokens so the sentence names the same units the button
  // does. The raw figure stays available on the SplError for anyone who needs the
  // exact number rather than the printable one.
  return {
    code,
    message: `${error.message} Short ${shortfall.toLocaleString('en-US', { maximumFractionDigits: 4 })} $xNFT.`,
    shortfall,
  }
}

/**
 * The owner's $xNFT balance. A missing token account is a balance of zero with
 * `exists: false`, not an error — plenty of visitors have simply never held the
 * token. Only an unreachable RPC produces a BurnError here.
 */
export async function fetchXnftBalance(owner: string, endpoint?: string): Promise<TokenBalance | BurnError> {
  const result = await fetchOwnerBalance(owner, endpoint)
  if (isSplError(result)) return toBurnError(result)
  return {
    uiAmount: result.uiAmount,
    decimals: result.decimals,
    rawAmount: result.rawAmount,
    exists: result.exists,
  }
}

/**
 * Builds the unsigned mint transaction: one transfer of 10,000 $xNFT to the
 * incinerator, which the buyer signs once.
 *
 * Returns a Transaction — it does not sign, send, or ask the wallet for
 * anything. The balance and the token account are checked first so an
 * underfunded wallet gets a sentence instead of a signature prompt it should
 * never have seen.
 */
export async function buildBurnTransaction(
  owner: string,
  options: BurnOptions = {},
): Promise<Transaction | BurnError> {
  const result = await buildMintTransaction(owner, options)
  return isSplError(result) ? toBurnError(result) : result
}

/**
 * Signs and sends the mint. Call this from a click handler and nowhere else —
 * it is the point of no return.
 *
 * Signing is delegated: `signAndSend` is the wallet's own method, so no key
 * material passes through this module. A confirmation timeout resolves as
 * success with unknown status, never as a failure — losing a signature that may
 * have landed invites a second burn.
 */
export async function sendBurn(
  owner: string,
  signAndSend: (tx: Transaction) => Promise<string>,
  options: BurnOptions = {},
): Promise<{ signature: string } | BurnError> {
  const result = await sendMint(owner, signAndSend, options)
  return isSplError(result) ? toBurnError(result) : result
}
