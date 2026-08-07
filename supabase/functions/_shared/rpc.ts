// Solana JSON-RPC, over plain fetch.
//
// Deliberately not @solana/web3.js: these functions need four read methods
// between them, and a raw fetch keeps the trust boundary auditable — the bytes
// that become a database row come from a response this file parsed, with no
// library in between deciding what "confirmed" means.
//
// Nothing here throws. A dead endpoint, a 429, or a garbled body all come back as
// an `upstream` FnError, because a transaction we could not read is not a
// transaction we may guess about.
import { fnError, isFnError, type FnError } from './http.ts'

/** One retry on a transient failure; more than that belongs to the caller's schedule. */
const RPC_ATTEMPTS = 2
const RPC_RETRY_DELAY_MS = 400
const RPC_TIMEOUT_MS = 15_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function rpcOnce<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T | FnError> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    })
    if (!response.ok) {
      return fnError('upstream', `Solana RPC returned ${response.status} for ${method}.`)
    }
    const body = await response.json()
    if (body && typeof body === 'object' && 'error' in body) {
      const detail = JSON.stringify((body as { error: unknown }).error)
      return fnError('upstream', `Solana RPC rejected ${method}.`, detail)
    }
    return (body as { result: T }).result
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown error'
    return fnError('upstream', `Could not reach Solana RPC for ${method}.`, detail)
  } finally {
    clearTimeout(timer)
  }
}

export async function solanaRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T | FnError> {
  let last: T | FnError = fnError('upstream', `Solana RPC was not called for ${method}.`)
  for (let attempt = 0; attempt < RPC_ATTEMPTS; attempt++) {
    last = await rpcOnce<T>(rpcUrl, method, params)
    if (!isFnError(last)) return last
    if (attempt + 1 < RPC_ATTEMPTS) await sleep(RPC_RETRY_DELAY_MS)
  }
  return last
}

// ---------------------------------------------------------------------------
// Response shapes — only the fields these functions actually read
// ---------------------------------------------------------------------------

/**
 * One instruction as `jsonParsed` returns it.
 *
 * `parsed` is present only for programs the node knows how to decode, and it is
 * occasionally a bare string rather than an object. Anything addressed to the
 * token program that arrives without a decoded `parsed` object is a hole in the
 * reading, and `_shared/transfers.ts` refuses the whole transaction rather than
 * counting the instructions it happened to understand.
 */
export interface RpcInstruction {
  programId?: string
  program?: string
  parsed?: { type?: unknown; info?: unknown } | string | null
  /** Present on instructions the node did not parse. */
  data?: string
  accounts?: string[]
}

/**
 * A token account's balance on one side of the transaction.
 *
 * `uiTokenAmount.amount` is a decimal string and is the only field here worth
 * reading — its `uiAmount` sibling is a float and is lossy by design. `owner` is
 * optional on older nodes; an entry without one leaves the owner null, and every
 * ownership match against null fails closed.
 */
export interface RpcTokenBalance {
  accountIndex: number
  mint: string
  owner?: string
  programId?: string
  uiTokenAmount: { amount: string; decimals: number }
}

export interface RpcTransaction {
  slot: number
  /** Unix seconds. Null on a block whose time the validator did not record. */
  blockTime: number | null
  transaction: {
    message: {
      /** Objects under `jsonParsed`, bare strings under `json`. Both are handled. */
      accountKeys: Array<{ pubkey: string } | string>
      instructions: RpcInstruction[]
    }
  }
  meta: {
    /** Non-null means the transaction landed but failed. Nothing moved. */
    err: unknown
    preTokenBalances?: RpcTokenBalance[] | null
    postTokenBalances?: RpcTokenBalance[] | null
    innerInstructions?: { index: number; instructions: RpcInstruction[] }[] | null
    loadedAddresses?: { writable: string[]; readonly: string[] }
  } | null
}

export interface RpcSignatureStatus {
  slot: number
  confirmations: number | null
  err: unknown
  confirmationStatus: 'processed' | 'confirmed' | 'finalized' | null
}

/**
 * `jsonParsed` rather than `json`: the whole ingest path is now built on the
 * node's own decoding of SPL token instructions and on `preTokenBalances` /
 * `postTokenBalances`. Hand-decoding token instruction data here would be a
 * second implementation of something every validator already does, and the
 * balance metadata — which is the stronger evidence — arrives either way.
 *
 * `confirmed` rather than `finalized`: a confirmed transaction has supermajority
 * votes and is not going to be rolled back in any realistic scenario, and waiting
 * ~13s longer for finality would make the mint flow feel broken. Reorg risk is
 * accepted because the index is rebuildable and the chain stays authoritative.
 */
export async function getTransaction(rpcUrl: string, signature: string): Promise<RpcTransaction | null | FnError> {
  return await solanaRpc<RpcTransaction | null>(rpcUrl, 'getTransaction', [
    signature,
    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ])
}

/**
 * `searchTransactionHistory` is on because a payout can sit pending long enough to
 * fall out of the validator's recent-status cache, and a cache miss reported as
 * "unknown" is the input to the one branch in confirm-payout that can mark a row
 * failed. Paying for the history lookup is cheap next to that.
 */
export async function getSignatureStatus(
  rpcUrl: string,
  signature: string,
): Promise<RpcSignatureStatus | null | FnError> {
  const result = await solanaRpc<{ value: (RpcSignatureStatus | null)[] }>(rpcUrl, 'getSignatureStatuses', [
    [signature],
    { searchTransactionHistory: true },
  ])
  if (isFnError(result)) return result
  return result?.value?.[0] ?? null
}

/**
 * The current block height, which is what decides whether a signature the chain
 * cannot find is late or dead.
 *
 * `finalized` on purpose, and it is the conservative direction: a finalized height
 * lags the confirmed one, so this reads *lower* than the true tip and a payout is
 * declared expired slightly later than it strictly could be. Erring late leaves a
 * row pending a few slots longer; erring early would mark a transaction failed
 * while it could still land, which is the one mistake this whole path is arranged
 * to avoid.
 */
export async function getBlockHeight(rpcUrl: string): Promise<number | FnError> {
  const result = await solanaRpc<number>(rpcUrl, 'getBlockHeight', [{ commitment: 'finalized' }])
  if (isFnError(result)) return result
  if (!Number.isFinite(result) || result < 0) {
    return fnError('upstream', 'Solana RPC returned no usable block height.')
  }
  return result
}

/**
 * A recent blockhash and the height past which it can no longer be included.
 *
 * Only `lastValidBlockHeight` is used, and only to stamp a payout row with the
 * height after which a signature that has never been seen definitively never
 * landed.
 */
export async function getLatestBlockhash(
  rpcUrl: string,
): Promise<{ blockhash: string; lastValidBlockHeight: number } | FnError> {
  const result = await solanaRpc<{ value: { blockhash: string; lastValidBlockHeight: number } }>(
    rpcUrl,
    'getLatestBlockhash',
    [{ commitment: 'confirmed' }],
  )
  if (isFnError(result)) return result
  if (!result?.value?.blockhash || !Number.isFinite(result.value.lastValidBlockHeight)) {
    return fnError('upstream', 'Solana RPC returned no recent blockhash.')
  }
  return result.value
}
