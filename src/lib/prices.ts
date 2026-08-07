// Live xStock pricing via Jupiter, with an honest fallback.
//
// Failure is a first-class path: if the API is unreachable, rate-limited, or
// returns a symbol we can't parse, we serve baked-in reference prices and mark
// the reading CACHED. The UI must never blank, spin forever, or render NaN.
import { XSTOCKS, allMints, stockByMint } from './xstocks'

export type PriceSource = 'live' | 'cached'

export interface PriceMap {
  /** symbol -> USD price. Always fully populated for every xStock. */
  bySymbol: Record<string, number>
  /** symbol -> 24h percent change. Only populated for live readings. */
  change24h: Record<string, number>
  source: PriceSource
  fetchedAt: number
}

const JUPITER_PRICE_URL = 'https://lite-api.jup.ag/price/v3'

export function referencePrices(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of XSTOCKS) out[s.symbol] = s.referencePrice
  return out
}

export function cachedFallback(): PriceMap {
  return { bySymbol: referencePrices(), change24h: {}, source: 'cached', fetchedAt: Date.now() }
}

/**
 * Fetches live prices. Never throws — always resolves to a usable PriceMap.
 * Any symbol missing from the response keeps its reference price.
 */
export async function fetchPrices(signal?: AbortSignal): Promise<PriceMap> {
  const prices = referencePrices()
  const change24h: Record<string, number> = {}

  try {
    const url = `${JUPITER_PRICE_URL}?ids=${allMints().join(',')}`
    const res = await fetch(url, { signal })
    if (!res.ok) return cachedFallback()

    const body = (await res.json()) as Record<
      string,
      { usdPrice?: number; priceChange24h?: number } | null
    >
    if (!body || typeof body !== 'object') return cachedFallback()

    let resolved = 0
    for (const [mint, entry] of Object.entries(body)) {
      const stock = stockByMint(mint)
      const usd = entry?.usdPrice
      if (!stock || typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) continue
      prices[stock.symbol] = usd
      resolved++

      const delta = entry?.priceChange24h
      if (typeof delta === 'number' && Number.isFinite(delta)) change24h[stock.symbol] = delta
    }

    // A response that resolved nothing is a failed response, whatever its status.
    if (resolved === 0) return cachedFallback()

    return { bySymbol: prices, change24h, source: 'live', fetchedAt: Date.now() }
  } catch {
    return cachedFallback()
  }
}
