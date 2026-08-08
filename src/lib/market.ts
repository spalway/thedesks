// Marketplace: outright sales and contracts (rentals).
//
// A contract is the differentiated trade here — the renter buys an xployee's
// output for a term, the owner takes guaranteed income instead of variable
// yield. Both sides of that bet are computed explicitly so the UI can show it.
import { yieldPerEpoch } from './accrual'
import { XNFT_DECIMALS, fromRawUnits, rentQuote, saleQuote } from './fees'
import type { Xployee } from './xployee'

/** The one token. Mints, listings and contracts are all denominated in $xNFT. */
export const TOKEN = 'xNFT'

/**
 * Simulated $xNFT/USD. This number is load-bearing: it is what makes minting a
 * fair bet instead of free money, so do not nudge it without redoing the
 * derivation below.
 *
 * WHAT A MINT COSTS. 10,000 $xNFT, burned, and nothing else — the 5% treasury leg
 * that used to ride on top is gone, so the debit fell from 10,500 to 10,000 and
 * the price had to rise to keep the bet fair.
 *
 * WHAT A MINT IS WORTH. Expected fair value across the tier distribution:
 *
 *   tier supply 60/25/12/3, principal = 1000 x skills
 *   E[principal]        = .60(1000) + .25(2000) + .12(3000) + .03(4000) = $1,580
 *   mean base APY       = sum(baseApy x weight) / sum(weight)
 *                       = 8.353 / 144                              = 5.8007%
 *   mean effective APY  = 5.8007% x mean proficiency (.80)         = 4.6406%
 *   fair-value multiple = 1 + apy/0.18 = 1 + 0.046406/0.18         = 1.25781x
 *   E[fair value]       = 1,580 x 1.25781                          = $1,987.34
 *
 * WHERE THE PRICE COMES FROM. EV-neutral is E[fair value] / mint cost in tokens:
 *
 *   1,987.34 / 10,000 = $0.198734 per $xNFT
 *
 * Rounded to $0.20 — a two-decimal price a docs page can print without a
 * rounding artefact. That rounding is the entire edge:
 *
 *   mint cost = 10,000 x 0.20 = $2,000.00
 *   mint edge = 2,000 / 1,987.34 - 1 = +0.64%
 *
 * Positive means the buyer pays a hair over fair value, which is the correct
 * direction for a lottery — the alternative is minting being strictly better than
 * buying the floor. The predecessor priced at 0.19 against a 10,500 debit for a
 * -0.35% edge; before that, XPL_USD = 0.42 charged $4,200 for the same $1,988 and
 * was never comparable anyway, since mints were denominated in $xNFT and the
 * market in $XPL with no conversion anywhere in the codebase.
 *
 * `fees.test.ts` recomputes every line of this from SKILLS and TIERS and asserts
 * the resulting mint EV stays within +/-2% of fair value, so a future tune to the
 * price, the burn, the tier table or the skill APYs that reopens the arbitrage
 * fails loudly instead of quietly.
 */
export const XNFT_USD = 0.2

/**
 * The `E[fair value]` line of the derivation above, in USD, rounded to the dollar
 * for display. Exported so the docs page and the economics test read the same
 * figure instead of each restating it — if the tier table or the skill APYs move,
 * one number changes and both the copy and the test that guards the arbitrage
 * follow.
 */
export const EXPECTED_MINT_VALUE_USD = 1_987

export type ListingKind = 'sale' | 'contract'

export interface SaleListing {
  kind: 'sale'
  xployee: Xployee
  /** Ask price in $xNFT. The seller receives this; the buyer also pays the 5% simulated fee. */
  price: number
  listedAt: number
}

export interface ContractListing {
  kind: 'contract'
  xployee: Xployee
  /** Fee per epoch in $xNFT, before the 10% rental fee. */
  feePerEpoch: number
  /** Contract length in epochs. */
  term: number
  listedAt: number
}

export type Listing = SaleListing | ContractListing

/** Fair sale value: capitalised yield plus principal, expressed in $xNFT. */
export function fairValueXnft(x: Xployee): number {
  const usd = x.principal + (x.principal * x.apy) / 0.18 // ~5.5x yield multiple
  return usd / XNFT_USD
}

/**
 * Buyer economics for a sale. The seller receives the ask; the 5% simulated
 * marketplace fee rides on top, so `totalXnft` is the only number that matters.
 *
 * Nothing here signs anything. A sale is a Supabase ledger entry — see the
 * Settlement section of the Docs page for why that one could not be made real
 * without an escrow program — so this fee is a number in the theatre, not a
 * transfer. It is not the mint, and the mint has no fee at all.
 */
export interface SaleMath {
  askXnft: number
  feeXnft: number
  totalXnft: number
}

export function saleMath(listing: SaleListing): SaleMath {
  const quote = saleQuote(listing.price, XNFT_DECIMALS)
  return {
    askXnft: fromRawUnits(quote.gross, XNFT_DECIMALS),
    feeXnft: fromRawUnits(quote.fee, XNFT_DECIMALS),
    totalXnft: fromRawUnits(quote.total, XNFT_DECIMALS),
  }
}

/**
 * Renter economics for a contract.
 *
 * `projectedYield` is what the worker is expected to produce over the term;
 * `cost` is what the renter actually pays, marketplace fee included. Margin is the
 * difference — positive means the renter is expected to profit, negative means
 * they're paying a premium.
 *
 * The fee is the point of this shape. Before it existed the margin reported here
 * was the margin of a trade nobody could make: with a 10% fee on top, break-even
 * moves from a listing spread of 1.0x to 0.909x, and listings are drawn from
 * 0.7-1.4x — so roughly a third of the range is profitable for the renter rather
 * than the ~43% the old number implied. Gross and fee are returned separately so
 * the UI can show the visitor where their money went.
 */
export interface ContractMath {
  /** Owner's take: feePerEpoch x term. */
  grossXnft: number
  /** Simulated marketplace rental fee, 10% of gross. */
  feeXnft: number
  /** What the renter is debited: gross + fee. */
  costXnft: number
  projectedYieldXnft: number
  marginXnft: number
  /** Margin as a share of cost. */
  marginPct: number
}

export function contractMath(listing: ContractListing): ContractMath {
  // Routed through fees.ts rather than multiplying by 1.1 here: fees.ts is the
  // sole implementation of the rate, so the margin quoted on a listing and the
  // amount a rental transfer would actually debit come from one place.
  const quote = rentQuote(listing.feePerEpoch, listing.term, XNFT_DECIMALS)
  const grossXnft = fromRawUnits(quote.gross, XNFT_DECIMALS)
  const feeXnft = fromRawUnits(quote.fee, XNFT_DECIMALS)
  const costXnft = fromRawUnits(quote.total, XNFT_DECIMALS)
  const projectedYieldXnft = (yieldPerEpoch(listing.xployee) * listing.term) / XNFT_USD
  const marginXnft = projectedYieldXnft - costXnft
  return {
    grossXnft,
    feeXnft,
    costXnft,
    projectedYieldXnft,
    marginXnft,
    marginPct: costXnft > 0 ? marginXnft / costXnft : 0,
  }
}

/**
 * The order book.
 *
 * Empty, and empty on purpose. This used to roll an RNG over the collection and
 * put ~18% of it on the market — 10% for sale, 8% up for hire — with prices
 * scattered around fair value. That was a demo of what a busy board looks like,
 * and shipping it would have opened the protocol with a secondary market in
 * which no one had ever listed anything and no listed xployee could be bought.
 *
 * Listings appear when holders create them. Until then the board is empty and
 * says so, and every consumer below already handles that: `floorPrice()`
 * returns 0, and Marketplace renders its `Empty` states.
 *
 * The pricing and margin maths above is untouched — it is what a listing will
 * be quoted with, and `fees.test.ts` still holds it to the fee schedule.
 */
export function listings(): Listing[] {
  return []
}

export function saleListings(): SaleListing[] {
  return listings().filter((l): l is SaleListing => l.kind === 'sale')
}

export function contractListings(): ContractListing[] {
  return listings().filter((l): l is ContractListing => l.kind === 'contract')
}

/** Lowest ask across all sale listings — the collection floor. */
export function floorPrice(): number {
  const sales = saleListings()
  if (sales.length === 0) return 0
  return sales.reduce((min, l) => Math.min(min, l.price), Infinity)
}

export function listingFor(id: number): Listing | undefined {
  return listings().find((l) => l.xployee.id === id)
}
