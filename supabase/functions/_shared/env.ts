// Server-side configuration.
//
// Same discipline as the three placeholder constants in `src/lib/spl.ts`, and
// deliberately the same three values: the $xNFT mint, the treasury wallet and the
// dev wallet. An address that does not exist yet is empty, and every path that
// would need it returns `not-configured` instead of guessing. $xNFT is not
// deployed at the time of writing, so the honest default is "unset" and the
// honest response to a call is a 503 that says so.
//
// Nothing here has a fallback value for a real address. There is no program id
// any more — the old `XNFT_PROGRAM_ID` gate is gone with the program — and what
// replaced it is a stricter thing rather than a looser one: ingestion no longer
// asks "did our program run?", it asks "did exactly these tokens move between
// exactly these accounts?", which nothing but the real transfer can satisfy.
//
// ONE GATE, THREE ADDRESSES, matching isConfigured() in src/lib/spl.ts. Every
// path here touches at least two of them — recognising a mint needs the mint and
// the treasury, settling a payout needs the treasury and the dev wallet — so a
// half-configured backend could only ever produce a reading nobody chose.
import { isValidAddress } from './base58.ts'
import { fnError, isFnError, type FnError } from './http.ts'

export interface FunctionConfig {
  /** Solana JSON-RPC endpoint. Public RPC rate-limits hard; set a real one. */
  rpcUrl: string
  /** Base58 mint address of $xNFT. The only mint any of these functions will index. */
  xnftMint: string
  /** The operator's treasury wallet. Fees land in its associated $xNFT account. */
  treasury: string
  /** Where a claim sends fees. Read from here, never from a request body. */
  devWallet: string
  /** Injected by the platform — the Edge Function's own project. */
  supabaseUrl: string
  /** Injected by the platform. Bypasses RLS; never leaves the server. */
  serviceRoleKey: string
  /**
   * Injected by the platform. Public by design — it is compiled into the browser
   * bundle — and used here only as the `apikey` header the auth endpoint requires
   * alongside a caller's own bearer token. It grants nothing on its own.
   */
  anonKey: string
}

/**
 * The subset of the configuration that has nothing to do with the chain.
 *
 * Most of the functions added after the mint — profiles, the marketplace, the
 * social layer, the SOL payout queue — touch no Solana address at all. Making
 * them call `loadConfig()` would gate the whole social layer behind a treasury
 * address nobody has set yet, which is a refusal with no hazard behind it and
 * exactly the kind of over-broad gate that teaches people to set placeholder
 * values.
 *
 * So the gate is split. `loadConfig()` still demands every chain constant for
 * every path that could move or index a token; this one demands only the platform
 * credentials a database write actually needs.
 */
export type PlatformConfig = Pick<FunctionConfig, 'supabaseUrl' | 'serviceRoleKey' | 'anonKey'>

export function loadPlatformConfig(): PlatformConfig | FnError {
  const supabaseUrl = read('SUPABASE_URL')
  const serviceRoleKey = read('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = read('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return fnError('not-configured', 'The function is missing its Supabase platform credentials.')
  }
  return { supabaseUrl, serviceRoleKey, anonKey }
}

function read(name: string): string {
  return (Deno.env.get(name) ?? '').trim()
}

function requireAddress(name: string, purpose: string): string | FnError {
  const value = read(name)
  if (!value) {
    return fnError('not-configured', `${name} is not set, so ${purpose}. Nothing was read and nothing was written.`)
  }
  if (!isValidAddress(value)) {
    return fnError('not-configured', `${name} is not a base58 Solana address.`)
  }
  return value
}

/**
 * Returns the whole config or the first reason it is unusable. Callers check once
 * at the top of a handler, so no downstream code has to consider a half-configured
 * environment.
 */
export function loadConfig(): FunctionConfig | FnError {
  const rpcUrl = read('SOLANA_RPC_URL')
  if (!rpcUrl) {
    return fnError('not-configured', 'SOLANA_RPC_URL is not set. No chain read was attempted.')
  }
  // A non-http endpoint would fail deep inside fetch with a confusing message.
  if (!/^https?:\/\//i.test(rpcUrl)) {
    return fnError('not-configured', 'SOLANA_RPC_URL must be an http(s) endpoint.')
  }

  const xnftMint = requireAddress('XNFT_MINT_ADDRESS', 'no transfer can be attributed to $xNFT')
  if (typeof xnftMint !== 'string') return xnftMint

  const treasury = requireAddress('TREASURY_ADDRESS', 'no fee leg can be recognised')
  if (typeof treasury !== 'string') return treasury

  const devWallet = requireAddress('DEV_WALLET_ADDRESS', 'no payout destination can be verified')
  if (typeof devWallet !== 'string') return devWallet

  // Two different wallets. If they were the same address a claim would be a
  // transfer from the treasury to itself, and confirm-payout would happily verify
  // a zero-value movement as a settled payout.
  if (treasury === devWallet) {
    return fnError('not-configured', 'TREASURY_ADDRESS and DEV_WALLET_ADDRESS must be different wallets.')
  }

  const platform = loadPlatformConfig()
  if (isFnError(platform)) return platform

  return { rpcUrl, xnftMint, treasury, devWallet, ...platform }
}
