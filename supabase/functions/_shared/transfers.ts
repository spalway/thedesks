// Reading a transaction as SPL token movements.
//
// This file replaces `_shared/anchor.ts`, which decoded Borsh event payloads out
// of `Program data:` log lines emitted by a program that will never be deployed.
// There are no events any more. What there is instead is better evidence:
//
//   preTokenBalances / postTokenBalances — the validator's own before-and-after
//   reading of every token account the transaction touched, in raw units, with
//   the mint, the owner and the decimals attached. This is not a log line the
//   transaction chose to print. It is the ledger's account of what changed.
//
//   parsed instructions — who instructed which transfer, from which account to
//   which, under whose authority.
//
// Both are needed and neither is sufficient. Deltas alone say "the treasury went
// up by 500" without saying who sent it or whether it was one transfer or four.
// Instructions alone say "a transferChecked of 500 was issued" without proving it
// executed — an instruction that reverts inside a failed inner call still appears
// in the message. `ingest-signature` demands they agree.
//
// Two properties the old log-scanning approach did not have, worth naming:
//
//   1. Log truncation is irrelevant. Solana caps log output per transaction, and
//      the old code had to refuse any truncated log because an event it could not
//      see was not an event that did not happen. Token balances are metadata, not
//      logs, and are never truncated.
//   2. There is no program id to trust. The old attribution problem — anyone can
//      print a base64 blob that looks like our event, so payloads had to be
//      attributed to the invoke frame that emitted them — does not exist here.
//      A token balance delta on the treasury's account for our mint cannot be
//      forged by a third-party program, because moving those tokens IS the thing
//      being claimed.
import { fnError, isFnError, type FnError } from './http.ts'
import {
  getTransaction,
  type RpcInstruction,
  type RpcTokenBalance,
  type RpcTransaction,
} from './rpc.ts'

/** Classic SPL Token and Token-2022. A mint under either is a mint we can read. */
const TOKEN_PROGRAM_IDS: ReadonlySet<string> = new Set([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
])

/**
 * The instruction types that move an existing balance between two token
 * accounts. `transfer` is the unchecked legacy form and `transferChecked` the one
 * `src/lib/spl.ts` builds; both are accepted because they are the same movement
 * of the same value, and refusing the legacy form would let an economically
 * identical mint go unindexed.
 *
 * `mintTo` and `burn` are deliberately absent: they change supply rather than
 * moving a balance between owners, and the deltas below account for them anyway,
 * so a transaction that quietly mints tokens fails the delta reconciliation in
 * `ingest-signature` instead of passing as a transfer.
 */
const TRANSFER_TYPES: ReadonlySet<string> = new Set([
  'transfer',
  'transferChecked',
  'transferCheckedWithFee',
])

const DIGITS = /^(0|[1-9][0-9]{0,19})$/

/** Digit strings only — the RPC sends u64 amounts as strings precisely so they survive. */
function parseAmount(value: unknown): bigint | null {
  if (typeof value !== 'string' || !DIGITS.test(value)) return null
  return BigInt(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface TokenTransfer {
  /**
   * Position in flattened execution order — top-level instruction, then the
   * inner instructions it produced, then the next top-level one.
   *
   * This is the per-event key. It is a property of the transaction rather than of
   * this reading, so re-ingesting the same signature derives the same index and
   * lands on the same primary key. That is what makes ingestion idempotent per
   * event rather than merely per signature.
   */
  index: number
  mint: string
  /** Token accounts, not wallets. */
  source: string
  destination: string
  /** Wallet owners, resolved from token-balance metadata. Null when the transaction did not report one. */
  sourceOwner: string | null
  destinationOwner: string | null
  /** The signer the token program required. */
  authority: string | null
  amount: bigint
}

export interface TokenAccountDelta {
  /** The token account address. */
  account: string
  mint: string
  owner: string | null
  pre: bigint
  post: bigint
  /** post − pre. Signed: this is the one place a negative number is meaningful. */
  change: bigint
  decimals: number
}

export interface TransferReading {
  signature: string
  slot: number
  /** Unix seconds, or null on a block whose time the validator did not record. */
  blockTime: number | null
  /** Every balance-moving token instruction, in execution order. */
  transfers: TokenTransfer[]
  /** Every token account the transaction touched, with its before and after. */
  deltas: TokenAccountDelta[]
}

// ---------------------------------------------------------------------------
// Account key resolution
// ---------------------------------------------------------------------------

/**
 * The transaction's full account list, in the order `accountIndex` refers to.
 *
 * Under `jsonParsed` the RPC already appends address-lookup-table accounts to
 * `accountKeys`, so the common path is a straight map. The `loadedAddresses`
 * fallback covers a node that did not — appending only when an index actually
 * points past the end, because appending unconditionally would shift every index
 * on the nodes that behave, which is exactly the sort of off-by-one that
 * attributes a transfer to the wrong account.
 */
function accountList(tx: RpcTransaction): string[] {
  const keys: string[] = []
  for (const key of tx.transaction?.message?.accountKeys ?? []) {
    if (typeof key === 'string') keys.push(key)
    else if (key && typeof key.pubkey === 'string') keys.push(key.pubkey)
    else keys.push('')
  }

  const loaded = tx.meta?.loadedAddresses
  if (!loaded) return keys

  const highest = Math.max(
    -1,
    ...(tx.meta?.preTokenBalances ?? []).map((b) => b.accountIndex),
    ...(tx.meta?.postTokenBalances ?? []).map((b) => b.accountIndex),
  )
  if (highest < keys.length) return keys

  return [...keys, ...(loaded.writable ?? []), ...(loaded.readonly ?? [])]
}

// ---------------------------------------------------------------------------
// Deltas
// ---------------------------------------------------------------------------

interface AccountFacts {
  mint: string
  owner: string | null
  decimals: number
}

/**
 * Folds pre and post token balances into one delta per token account.
 *
 * An account present in only one of the two lists is still a delta: a token
 * account created during the transaction has no pre-balance, and one closed
 * during it has no post-balance. Treating the missing side as zero is correct in
 * both cases and is why a mint that opens the treasury's associated account in
 * the same transaction still reconciles.
 */
function readDeltas(tx: RpcTransaction, keys: string[]): {
  deltas: TokenAccountDelta[]
  facts: Map<string, AccountFacts>
} | FnError {
  const pre = new Map<number, bigint>()
  const post = new Map<number, bigint>()
  const facts = new Map<string, AccountFacts>()
  const touched = new Set<number>()

  const ingest = (
    entries: RpcTokenBalance[] | null | undefined,
    into: Map<number, bigint>,
  ): FnError | null => {
    for (const entry of entries ?? []) {
      const index = entry?.accountIndex
      if (!Number.isInteger(index) || index < 0 || index >= keys.length) {
        return fnError('rejected', 'A token balance referred to an account this reading cannot resolve.')
      }
      const amount = parseAmount(entry?.uiTokenAmount?.amount)
      const mint = str(entry?.mint)
      const decimals = entry?.uiTokenAmount?.decimals
      if (amount === null || mint === null || !Number.isInteger(decimals)) {
        return fnError('rejected', 'A token balance came back in a form this backend will not parse.')
      }
      const address = keys[index]
      if (!address) {
        return fnError('rejected', 'A token balance referred to an account with no address.')
      }

      const existing = facts.get(address)
      if (existing && (existing.mint !== mint || existing.decimals !== decimals)) {
        // The same account reporting two mints or two decimal counts across pre
        // and post is not a transaction this backend will guess about.
        return fnError('rejected', 'A token account disagreed with itself about its mint or decimals.')
      }
      facts.set(address, {
        mint,
        // `owner` is optional on older nodes. Prefer whichever side reported one;
        // an unresolved owner is left null and every match against it fails.
        owner: str(entry?.owner) ?? existing?.owner ?? null,
        decimals: decimals as number,
      })
      into.set(index, amount)
      touched.add(index)
    }
    return null
  }

  const preError = ingest(tx.meta?.preTokenBalances, pre)
  if (preError) return preError
  const postError = ingest(tx.meta?.postTokenBalances, post)
  if (postError) return postError

  const deltas: TokenAccountDelta[] = []
  for (const index of touched) {
    const address = keys[index]
    const fact = facts.get(address)
    if (!fact) continue
    const before = pre.get(index) ?? 0n
    const after = post.get(index) ?? 0n
    deltas.push({
      account: address,
      mint: fact.mint,
      owner: fact.owner,
      pre: before,
      post: after,
      change: after - before,
      decimals: fact.decimals,
    })
  }

  return { deltas, facts }
}

// ---------------------------------------------------------------------------
// Instructions
// ---------------------------------------------------------------------------

/**
 * Top-level instructions interleaved with the inner instructions each one
 * produced, in execution order.
 *
 * Inner instructions matter: a transfer issued by a CPI is every bit as real as
 * one at the top level, and reading only the outer list would miss a mint routed
 * through any wrapper program. The order is what `index` on a TokenTransfer
 * means, so it has to be derived the same way every time this runs.
 */
function flattenInstructions(tx: RpcTransaction): RpcInstruction[] {
  const outer = tx.transaction?.message?.instructions ?? []
  const inner = new Map<number, RpcInstruction[]>()
  for (const group of tx.meta?.innerInstructions ?? []) {
    if (Number.isInteger(group?.index)) inner.set(group.index, group.instructions ?? [])
  }

  const flat: RpcInstruction[] = []
  for (let i = 0; i < outer.length; i++) {
    flat.push(outer[i])
    for (const ix of inner.get(i) ?? []) flat.push(ix)
  }
  return flat
}

/**
 * Turns one parsed instruction into a transfer, or null if it is not one.
 *
 * Returns an FnError — not null — for an instruction addressed to a token
 * program that the RPC did not parse. That case is the dangerous one: it means
 * this reading cannot see something the token program did, and "cannot see" must
 * never be reported upward as "did not happen". Callers that count legs would
 * otherwise accept a transaction with a hidden third transfer in it.
 */
function readTransfer(
  ix: RpcInstruction,
  index: number,
  facts: Map<string, AccountFacts>,
): TokenTransfer | null | FnError {
  const programId = str(ix?.programId)
  const isTokenProgram = programId !== null && TOKEN_PROGRAM_IDS.has(programId)

  const parsed = ix?.parsed
  if (typeof parsed !== 'object' || parsed === null) {
    if (isTokenProgram) {
      return fnError(
        'rejected',
        'The transaction contains a token instruction this backend could not read. Nothing was indexed.',
      )
    }
    return null
  }
  if (!isTokenProgram) return null

  const type = str(parsed.type)
  if (type === null || !TRANSFER_TYPES.has(type)) return null

  const info = (parsed.info ?? {}) as Record<string, unknown>
  const source = str(info.source)
  const destination = str(info.destination)
  if (!source || !destination) {
    return fnError('rejected', 'A token transfer named no source or no destination.')
  }

  // `transferChecked` carries its own mint and a tokenAmount object; the legacy
  // `transfer` carries a bare amount and no mint at all, so the mint has to come
  // from the account's own balance metadata. Refusing when neither is available
  // keeps an unattributable transfer out of the count rather than guessing.
  const checked = (info.tokenAmount ?? null) as { amount?: unknown } | null
  const amount = parseAmount(checked?.amount) ?? parseAmount(info.amount)
  if (amount === null) {
    return fnError('rejected', 'A token transfer carried an amount this backend will not parse.')
  }

  const mint = str(info.mint) ?? facts.get(source)?.mint ?? facts.get(destination)?.mint ?? null
  if (!mint) {
    return fnError('rejected', 'A token transfer could not be attributed to a mint.')
  }

  return {
    index,
    mint,
    source,
    destination,
    sourceOwner: facts.get(source)?.owner ?? null,
    destinationOwner: facts.get(destination)?.owner ?? null,
    authority: str(info.authority) ?? str(info.multisigAuthority),
    amount,
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Fetches a signature and reads it as token movements.
 *
 * Every refusal below is one of two kinds and they are kept distinct in the error
 * code, because the caller's correct response differs:
 *
 *   `not-found` — the chain has not caught up to this signature. Retryable; this
 *                 is the normal state for the first second after a send.
 *   `rejected`  — the chain has answered and the answer is not something this
 *                 backend will index. Not retryable.
 *
 * A transaction that landed with an error is `rejected`: it moved nothing, so
 * indexing it would invent a fee that was never paid.
 */
export async function readTransfers(
  rpcUrl: string,
  signature: string,
): Promise<TransferReading | FnError> {
  const tx = await getTransaction(rpcUrl, signature)
  if (isFnError(tx)) return tx
  if (tx === null) {
    return fnError('not-found', 'The chain has not seen this signature yet. Nothing was written; try again shortly.')
  }

  const meta = tx.meta
  if (!meta) {
    return fnError('rejected', 'The transaction was returned without metadata, so nothing can be read from it.')
  }
  if (meta.err !== null && meta.err !== undefined) {
    return fnError('rejected', 'That transaction failed on-chain, so nothing moved and nothing was indexed.')
  }

  const keys = accountList(tx)
  const read = readDeltas(tx, keys)
  if (isFnError(read)) return read

  const transfers: TokenTransfer[] = []
  const flat = flattenInstructions(tx)
  for (let i = 0; i < flat.length; i++) {
    const transfer = readTransfer(flat[i], i, read.facts)
    if (isFnError(transfer)) return transfer
    if (transfer) transfers.push(transfer)
  }

  return {
    signature,
    slot: tx.slot,
    blockTime: typeof tx.blockTime === 'number' ? tx.blockTime : null,
    transfers,
    deltas: read.deltas,
  }
}

// ---------------------------------------------------------------------------
// Queries over a reading
// ---------------------------------------------------------------------------

/** Every transfer of one mint, in execution order. */
export function transfersOfMint(reading: TransferReading, mint: string): TokenTransfer[] {
  return reading.transfers.filter((t) => t.mint === mint)
}

/**
 * How much of `mint` an owner's holdings changed by, summed across every token
 * account they own.
 *
 * Summed rather than read off a single account because an owner may hold the same
 * mint in more than one account, and "the associated one went up by 500" is a
 * weaker statement than "this wallet is 500 better off". The second is the one
 * worth checking a transfer against.
 *
 * Returns null when no account of that owner and mint appears in the transaction
 * at all — which is different from a change of zero, and the caller should treat
 * it as such.
 */
export function netChangeFor(reading: TransferReading, mint: string, owner: string): bigint | null {
  let seen = false
  let total = 0n
  for (const delta of reading.deltas) {
    if (delta.mint !== mint || delta.owner !== owner) continue
    seen = true
    total += delta.change
  }
  return seen ? total : null
}

/**
 * Whether every movement of `mint` in this reading was attributed to a wallet.
 *
 * This is the question you have to answer before you are allowed to say a
 * transfer is ABSENT. `owner` is optional in the RPC's token-balance metadata —
 * older nodes omit it, and this module leaves it null rather than guessing — so a
 * filter looking for a transfer between two known wallets comes back empty in two
 * completely different situations: the transfer was not there, or the transfer
 * was there and nothing said whose accounts it moved between. Every comparison
 * against null fails identically, which makes the two indistinguishable at the
 * call site unless it asks this.
 *
 * Both sources are checked. The legs matter because that is what a caller filters
 * on; the deltas matter because that is what an amount is read from, and an
 * unattributed delta hides value moving into an account this reading cannot name.
 *
 * Used by confirm-payout, where the difference decides whether a claim that may
 * have landed is written down as failed — and a claim wrongly written down as
 * failed is a second withdrawal, because the operator's response to a failure is
 * to claim again.
 */
export function ownersFullyAttributed(reading: TransferReading, mint: string): boolean {
  for (const transfer of reading.transfers) {
    if (transfer.mint !== mint) continue
    if (transfer.sourceOwner === null || transfer.destinationOwner === null) return false
  }
  for (const delta of reading.deltas) {
    if (delta.mint !== mint) continue
    if (delta.owner === null) return false
  }
  return true
}

/** The decimals the transaction itself reports for a mint, or null if it touched no account of it. */
export function decimalsOf(reading: TransferReading, mint: string): number | null {
  for (const delta of reading.deltas) {
    if (delta.mint === mint) return delta.decimals
  }
  return null
}

/** ISO 8601 for a block time, or null. A wrong timestamp on a fee row is worse than a missing one. */
export function toIsoTime(blockTime: number | null): string | null {
  if (blockTime === null || !Number.isFinite(blockTime)) return null
  return new Date(blockTime * 1000).toISOString()
}
