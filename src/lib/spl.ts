// Every real transfer of $xNFT this app can make, composed from plain SPL Token
// instructions. No program, no PDAs, no IDL.
//
// This file replaces the hand-rolled Anchor client that used to live in
// ./program. That program was abandoned before it was ever deployed, and what it
// bought turned out to be worth exactly one thing — escrow for an outright sale.
// Everything else it did was a bundle of transfers that a wallet can sign
// directly, atomically, for the cost of one transaction:
//
//   MINT      ONE `transferChecked`: 10,000 $xNFT from the buyer to the PROJECT
//             WALLET. That is the whole transaction. There is no protocol fee, no
//             treasury leg and no second destination — see the note below,
//             because the absence is load-bearing.
//
//             This was a burn to the incinerator and is now revenue. The
//             instruction is identical; the claim the interface may make about it
//             is not. Supply does not shrink, nothing is destroyed, and no copy
//             anywhere in the app may say otherwise.
//   RENT      The renter pays the owner `fee_per_epoch × term` and the treasury
//             10% of that, in one transaction. The xployee never moves, so
//             nothing has to be held in escrow for a rental to be safe. NOT
//             WIRED — no component calls it; rentals are Supabase rows.
//   CLAIM     The operator moves accrued fees out of the treasury to the dev
//             wallet. See `claimTransfer` for what that does and does not mean.
//
// THE MINT FEE IS GONE, not zeroed. A mint used to carry a second leg of 500
// $xNFT to the treasury. It does not any more, and the way it does not matters:
// there is no fee argument defaulting to zero, no `Quote` with an empty `fee`
// field, and no bps constant on the mint path at all. A dormant fee parameter is
// a fee somebody re-enables by accident, so the concept was removed rather than
// set to nothing. `mintTransfer` returns a single instruction, and the test that
// says so asserts the count.
//
// SALES ARE NOT HERE, and their absence is the honest part. An atomic swap of an
// NFT for $xNFT without an escrow program requires both parties to co-sign one
// transaction, which a marketplace cannot arrange. Sales stay Supabase ledger
// entries — simulated, like the rest of the collection. Nothing in this file
// pretends otherwise.
//
// The rules this module is written under, all of which survived the program's
// removal because none of them ever depended on it:
//
//   1. Nothing throws. Every async path resolves to an SplError the UI can
//      render, including a malformed RPC URL and a mint that decodes to garbage.
//   2. Configuration is a gate. The deployment constants below default to empty
//      and every path refuses while what it needs is unset. There are two checks,
//      not one, and the split follows the money: isMintConfigured() wants the
//      $xNFT mint AND the project wallet, because a mint now pays a configured
//      address and there is no safe default for where money goes; isConfigured()
//      additionally wants the treasury, because rent and claim touch it.
//   3. Destinations are never caller-supplied. The project wallet, the treasury
//      and the dev wallet are module configuration read from the environment. A
//      transfer helper that accepted a destination would be an arbitrary-transfer
//      primitive wearing a friendlier name.
//   4. Building and sending are separate calls. The build* functions return an
//      unsigned Transaction and ask the wallet for nothing.
//   5. A confirmation timeout is success-with-unknown-status, never failure.
//      Presenting a transfer that may have landed as a failure is what invites a
//      duplicate of an irreversible one. The single exception is the case where
//      the unknown status is not unknown at all: a transaction whose blockhash
//      has expired while the cluster has never seen its signature can no longer
//      land, and calling that a success is the mirror-image lie — telling someone
//      their money moved when it did not.
//   6. Money is bigint raw units. The only float here is the display `uiAmount`
//      on a balance read, and it never decides an amount.
//   7. Fee arithmetic lives in ./fees and nowhere else. A second implementation
//      of the multiply is a second rounding direction waiting to disagree with
//      the number the visitor was quoted.
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  unpackMint,
} from '@solana/spl-token'
import { MINT_BURN, SIM_RENT_FEE_BPS, mintAmount, quoteFor, type RentQuote } from './fees'
import { getRuntimeConfig, isMintArmed } from './runtimeConfig'

/**
 * A deployment address, read from the RUNTIME config at call time.
 *
 * Never at module scope. These used to be `export const` initialised from
 * import.meta.env, which meant the value was fixed when the bundle was built and
 * changing the mint address required a redeploy. They now come from a Supabase
 * row an operator can edit live, so anything that caches one of these at import
 * time would pin the old value for the life of the tab — which is exactly the
 * bug this change exists to remove.
 */
function cfg() {
  return getRuntimeConfig()
}


// ---------------------------------------------------------------------------
// Deployment configuration — read live, never captured at import time
// ---------------------------------------------------------------------------

/**
 * The $xNFT SPL mint, as configured right now.
 *
 * A FUNCTION, not a constant, and that is the whole point of this change. It was
 * `export const xnftMintAddress()` built from an env var, so the value froze when
 * the bundle was built and a wrong or rotated mint address could only be fixed by
 * redeploying. It now comes from a Supabase row: an operator edits it and every
 * open tab follows within one poll.
 *
 * Do not cache the result. Read it at the moment you need it, or you have
 * reintroduced exactly the staleness this replaced.
 */
export function xnftMintAddress(): string {
  return cfg().xnftMint
}

/**
 * The treasury wallet.
 *
 * An ordinary wallet whose keypair the operator holds, NOT a PDA. Rental fees
 * land in its associated $xNFT account and only a signature from that keypair can
 * move them — a weaker guarantee than a program's treasury PDA, stated plainly:
 * with no program, custody of the fee balance is custody of a private key.
 *
 * NOT a mint destination. Minting pays it nothing.
 */
export function treasuryAddress(): string {
  return cfg().treasuryWallet
}

/**
 * Where a mint's proceeds go, and where claimed fees are sent.
 *
 * Read from config and never from a parameter, so no call site can point a
 * payment at its own wallet. What this is not: with no program to pin it with an
 * on-chain address constraint, this is a destination *this client* enforces.
 */
export function devWalletAddress(): string {
  return cfg().devWallet
}


/**
 * Solana's canonical incinerator. Nobody holds this key, so tokens parked in its
 * token account are gone for good — which is exactly the point.
 *
 * A module constant and never a parameter: swapping the destination is the
 * difference between burning 10,000 $xNFT and sending 10,000 $xNFT to a stranger.
 */
export const INCINERATOR_ADDRESS = '1nc1nerator11111111111111111111111111111111'

/**
 * Public RPC is aggressively rate-limited and drops requests under any real
 * traffic. A production deployment wants its own endpoint passed through the
 * `endpoint` argument every read and build accepts.
 */
export const DEFAULT_RPC = clusterApiUrl('mainnet-beta')

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type SplErrorCode =
  /** A deployment constant is unset, or the configured mint is not a usable SPL mint. */
  | 'not-configured'
  | 'no-wallet'
  | 'no-token-account'
  | 'insufficient-balance'
  /** The arguments describe a transfer that makes no sense — a zero term, a negative amount. */
  | 'invalid-request'
  /** The signer does not own the treasury token account, so the token program would reject it. */
  | 'not-operator'
  | 'rejected'
  | 'network'
  | 'unknown'

export interface SplError {
  code: SplErrorCode
  message: string
  /**
   * Raw units still needed, when the failure is about balance. Carries its own
   * decimals so a caller can render it without re-reading the mint — and stays
   * bigint, because a u64 shortfall at 9 decimals does not survive a float.
   */
  shortfall?: { raw: bigint; decimals: number }
}

const SPL_ERROR_CODES: ReadonlySet<string> = new Set<SplErrorCode>([
  'not-configured',
  'no-wallet',
  'no-token-account',
  'insufficient-balance',
  'invalid-request',
  'not-operator',
  'rejected',
  'network',
  'unknown',
])

/** Refusal for a path that needs the treasury or the dev wallet: rent, claim. */
const NOT_CONFIGURED =
  'The $xNFT mint, the treasury wallet or the dev wallet has not been set. No transaction was built.'

/**
 * Refusal for the mint path, which needs the mint address and nothing else.
 *
 * A separate sentence rather than the one above, because naming the treasury in a
 * message about a transaction that does not pay the treasury is how an operator
 * ends up setting an address to unblock something it has no part in.
 */
const MINT_NOT_CONFIGURED =
  'The $xNFT mint address has not been set. No transaction was built.'

export function isSplError(v: unknown): v is SplError {
  if (typeof v !== 'object' || v === null) return false
  const candidate = v as { code?: unknown; message?: unknown }
  return (
    typeof candidate.code === 'string' &&
    SPL_ERROR_CODES.has(candidate.code) &&
    typeof candidate.message === 'string'
  )
}

function fail(code: SplErrorCode, message: string): SplError {
  return { code, message }
}

function short(code: SplErrorCode, message: string, raw: bigint, decimals: number): SplError {
  return { code, message, shortfall: { raw, decimals } }
}

function rpcFail(e: unknown): SplError {
  const detail = e instanceof Error ? e.message : 'unknown error'
  return fail('network', `Could not reach Solana: ${detail}`)
}

/** Returns null rather than throwing, so an unset or malformed address is just "not configured". */
function parseKey(value: string): PublicKey | null {
  if (!value) return null
  try {
    return new PublicKey(value)
  } catch {
    return null
  }
}

/**
 * Like parseKey, but only for an address that is supposed to be a wallet.
 *
 * An off-curve address has no private key, so it can neither sign nor own an
 * associated token account by the default derivation — and asking spl-token for
 * one throws. Refusing it here turns that throw into a rendered sentence, which
 * is the whole contract this module is under.
 */
function parseWallet(value: string): PublicKey | null {
  const key = parseKey(value)
  if (!key || !PublicKey.isOnCurve(key.toBytes())) return null
  return key
}

/**
 * False until the $xNFT mint address holds a usable key. The gate on minting and
 * on reading a wallet's balance, and the whole of it.
 *
 * It asks for TWO addresses, and it did not always. While a mint was a burn, the
 * destination was the hard-coded incinerator and the mint address alone was the
 * whole configuration — there was no payee to get wrong. Proceeds now go to the
 * project wallet, so there is exactly one configurable destination again, and an
 * unset one is the worst possible failure: a transaction that looks right and
 * pays nobody, or pays whatever a malformed constant happens to parse into.
 */
export function isMintConfigured(): boolean {
  // isMintArmed() additionally honours the operator's minting_enabled switch,
  // which is how a mint gets stopped without destroying the address that would
  // otherwise have to be cleared to stop it.
  return isMintArmed() && parseKey(xnftMintAddress()) !== null && parseWallet(devWalletAddress()) !== null
}

/**
 * False until all three deployment constants hold usable keys. The gate on the
 * paths that pay a configured wallet: rent and claim.
 *
 * One gate rather than two, deliberately. Both remaining paths touch the treasury
 * — a rental pays it, a claim empties it — and a claim also needs the dev wallet,
 * so a partially configured build could only ever produce a transfer to a
 * destination nobody chose. Refusing until the whole set is present is cheaper to
 * reason about than a matrix of half-armed states.
 */
export function isConfigured(): boolean {
  return (
    isMintConfigured() &&
    parseWallet(treasuryAddress()) !== null &&
    parseWallet(devWalletAddress()) !== null
  )
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/** Reused per endpoint so repeated reads share one client rather than opening a new one each call. */
const connections = new Map<string, Connection>()

export function getConnection(endpoint?: string): Connection {
  const url = endpoint ?? DEFAULT_RPC
  const existing = connections.get(url)
  if (existing) return existing
  const created = new Connection(url, 'confirmed')
  connections.set(url, created)
  return created
}

/**
 * web3.js rejects a non-http endpoint by throwing out of the Connection
 * constructor. Every async path opens its client through here so a malformed RPC
 * URL arrives as an SplError like every other failure, rather than as a rejected
 * promise from a module that promises never to throw.
 */
function openConnection(endpoint?: string): Connection | SplError {
  try {
    return getConnection(endpoint)
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'unknown error'
    return fail('network', `Invalid Solana RPC endpoint: ${detail}`)
  }
}

// ---------------------------------------------------------------------------
// Market: everything a transfer needs resolved before it can be built
// ---------------------------------------------------------------------------

/**
 * Everything a mint needs resolved: the token, how to address it, and how it
 * counts.
 *
 * Split out from `Market` when the mint fee was removed. A mint no longer has a
 * configured payee, so carrying the treasury and dev wallet through the mint path
 * would mean a mint could be blocked by an address it never uses.
 */
export interface MintMarket {
  xnftMint: PublicKey
  /**
   * Classic SPL Token or Token-2022, read off the mint account's owner rather
   * than assumed. Getting this wrong makes every ATA derivation below point at an
   * address that does not exist.
   */
  tokenProgram: PublicKey
  /** Read off the mint, never assumed. `transferChecked` fails on-chain if it disagrees. */
  decimals: number
  /**
   * Where a mint's 10,000 $xNFT goes: the project wallet.
   *
   * This used to be the hard-coded incinerator, and a mint was a burn. It is now
   * a configured address the operator sets, which is a real weakening and is why
   * `isMintConfigured` had to start demanding it. A build with no proceeds
   * address must refuse to mint rather than fall back to anything — there is no
   * safe default for "where does the money go".
   */
  proceeds: PublicKey
}

/** A MintMarket plus the two configured wallets that rent and claim actually pay. */
export interface Market extends MintMarket {
  /** The operator's wallet. Its ATA is the treasury; the wallet itself is the transfer authority. */
  treasury: PublicKey
  devWallet: PublicKey
}

/** Every SPL token amount is a u64. Nothing larger has a representation to send. */
export const U64_MAX = 2n ** 64n - 1n

/**
 * The largest decimal count at which one mint is still expressible on-chain.
 *
 * Derived, never typed out, because the answer moves with MINT_BURN: it is the
 * last exponent at which the whole debit still fits a u64. The scan starts at 0
 * and stops at the first exponent that overflows, so the ceiling is whatever the
 * arithmetic in ./fees says it is rather than a 15 somebody has to remember to
 * update. Raise MINT_BURN to 100,000 and this falls to 14 on its own.
 *
 * The upper bound of the scan is 18 because that is where ./fees stops computing
 * at all, not because 18 means anything here; with the fee gone the binding
 * constraint is 10^4 x 10^d <= 2^64-1, which runs out first.
 *
 * It matters that the ceiling is *this* number and not the 18 ./fees will happily
 * scale to. `createTransferCheckedInstruction` does not reject an amount too big
 * for its u64 field — it encodes the low bytes and hands back a perfectly valid
 * instruction for a completely different quantity of real tokens. The overflow
 * has no error path, so the only place it can be caught is before it is built,
 * and refusing the mint as unconfigurable is the only honest outcome: there is no
 * amount this client could send that means what the quote says.
 *
 * -1 when even zero decimals overflow, which would make every mint refuse. That
 * is unreachable at any sane MINT_BURN and is spelled out anyway, because the
 * fallback for "no decimal count works" must not be "accept 0".
 */
export const MAX_MINT_DECIMALS: number = (() => {
  let last = -1
  for (let decimals = 0; decimals <= 18; decimals++) {
    if (mintAmount(decimals) > U64_MAX) break
    last = decimals
  }
  return last
})()

/**
 * Resolves the mint's token program and decimals from the chain.
 *
 * Both are read rather than assumed, and that is not defensiveness for its own
 * sake: `transferChecked` carries the decimals in its instruction data precisely
 * so the token program can reject a client that guessed, and a Token-2022 mint
 * addressed through the classic program simply is not found.
 */
async function resolveMintMarket(connection: Connection): Promise<MintMarket | SplError> {
  const xnftMint = parseKey(xnftMintAddress())
  if (!xnftMint) return fail('not-configured', MINT_NOT_CONFIGURED)

  // Resolved before the account read, not after: a build with no proceeds wallet
  // can never produce a valid mint, so spending an RPC round trip to discover
  // that would only delay the same refusal.
  const proceeds = parseWallet(devWalletAddress())
  if (!proceeds) return fail('not-configured', MINT_NOT_CONFIGURED)

  let info
  try {
    info = await connection.getAccountInfo(xnftMint)
  } catch (e) {
    return rpcFail(e)
  }
  if (!info) return fail('not-configured', 'The configured $xNFT mint does not exist on this cluster.')

  const tokenProgram = info.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : info.owner.equals(TOKEN_PROGRAM_ID)
      ? TOKEN_PROGRAM_ID
      : null
  if (!tokenProgram) return fail('not-configured', 'The configured $xNFT address is not an SPL token mint.')

  try {
    const mint = unpackMint(xnftMint, info, tokenProgram)
    // Guarded before it ever reaches 10n ** BigInt(decimals) in ./fees, which
    // throws on an implausible exponent — and this module does not throw.
    //
    // The ceiling is MAX_MINT_DECIMALS rather than the 18 ./fees tolerates,
    // because the two are answering different questions. ./fees only has to
    // compute the number; this module has to encode it, and a mint priced past
    // u64 gets truncated into a smaller amount without a word of complaint. A
    // wider guard here than the instruction can actually carry is not leniency,
    // it is a wrong amount of real tokens with a valid signature on it.
    //
    // Applied to rent and claim as well, via `resolveMarket`. A $xNFT whose
    // decimals cannot express the protocol's headline action is not a usable
    // configuration for any of them, and a rental denominated in a token this
    // client cannot mint against would be a stranger state than a refusal.
    if (
      !Number.isInteger(mint.decimals) ||
      mint.decimals < 0 ||
      mint.decimals > MAX_MINT_DECIMALS
    ) {
      return fail(
        'not-configured',
        `The configured $xNFT mint reports ${mint.decimals} decimals. A mint costs ${MINT_BURN} $xNFT, which only fits an SPL token amount at ${MAX_MINT_DECIMALS} decimals or fewer.`,
      )
    }
    return { xnftMint, tokenProgram, decimals: mint.decimals, proceeds }
  } catch {
    return fail('not-configured', 'The configured $xNFT mint could not be decoded.')
  }
}

/**
 * The full market: the mint, plus the two wallets rent and claim pay.
 *
 * Layered on `resolveMintMarket` rather than duplicating the account read, so
 * there is exactly one place that decides which token program a mint speaks and
 * exactly one decimals guard.
 */
async function resolveMarket(connection: Connection): Promise<Market | SplError> {
  const treasury = parseWallet(treasuryAddress())
  const devWallet = parseWallet(devWalletAddress())
  if (!treasury || !devWallet) return fail('not-configured', NOT_CONFIGURED)

  const mintMarket = await resolveMintMarket(connection)
  if (isSplError(mintMarket)) return mintMarket

  return { ...mintMarket, treasury, devWallet }
}

// ---------------------------------------------------------------------------
// Quotes — pure, network-free, and every one of them a call into ./fees
// ---------------------------------------------------------------------------

/**
 * One rental: the owner receives `feePerEpoch × term` and the renter pays 10% on
 * top of it. Amounts are already raw units — the whole-token entry point is
 * `rentQuote` in ./fees, and this is the same split for callers that are already
 * holding bigints.
 *
 * The fee is taken on the contract total rather than per epoch. Flooring once on
 * the whole instead of `term` times is the difference between the treasury
 * keeping the rounding dust and throwing away up to one raw unit per epoch, and
 * ./fees made that choice first.
 */
export function quoteRent(feePerEpoch: bigint, termEpochs: number): RentQuote {
  const gross = feePerEpoch * BigInt(termEpochs)
  return { ...quoteFor(gross, SIM_RENT_FEE_BPS), perEpoch: feePerEpoch, term: termEpochs }
}

// ---------------------------------------------------------------------------
// Token accounts
// ---------------------------------------------------------------------------

const incineratorKey = new PublicKey(INCINERATOR_ADDRESS)

/**
 * A wallet's associated $xNFT account.
 *
 * The off-curve guard stays ON here, and that asymmetry with
 * `incineratorTokenAccount` below is load-bearing. A wallet address that is off
 * the ed25519 curve has no private key: deriving an ATA for it would produce an
 * account whose owner can never sign a transfer out of it, so tokens sent there
 * are stuck. Letting spl-token throw, and turning that into a `no-wallet`, is the
 * correct outcome for every owner in this file except one.
 */
export function tokenAccountFor(market: MintMarket, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    market.xnftMint,
    owner,
    false,
    market.tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )
}

/**
 * The incinerator's associated $xNFT account.
 *
 * The one place the off-curve guard is relaxed, because "nobody can sign for this
 * account" is not a hazard here — it is the entire mechanism. 1nc1nerator… is off
 * the curve by construction, so the default derivation refuses it and this
 * separate function exists rather than a boolean parameter on the one above. A
 * parameter would let a caller opt any owner out of the guard.
 */
export function incineratorTokenAccount(market: MintMarket): PublicKey {
  return getAssociatedTokenAddressSync(
    market.xnftMint,
    incineratorKey,
    true,
    market.tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )
}

/**
 * Whether a token account is already open. A missing account is `false`, not an
 * error; only an unreachable RPC is an error, because reporting a dead endpoint
 * as "no account" would add a create instruction for an account that exists.
 */
async function tokenAccountExists(
  connection: Connection,
  market: MintMarket,
  address: PublicKey,
): Promise<boolean | SplError> {
  try {
    await getAccount(connection, address, undefined, market.tokenProgram)
    return true
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError || e instanceof TokenInvalidAccountOwnerError) {
      return false
    }
    return rpcFail(e)
  }
}

/**
 * The create instruction a destination needs, or null when it is already open.
 *
 * Idempotent rather than plain create even though existence was just checked:
 * between that read and the wallet actually sending, anyone at all may open the
 * account — and a plain create that finds it already there fails the whole
 * transaction, which would take the burn down with it. The idempotent variant
 * no-ops instead. `payer` funds the rent, so it is always the person signing.
 */
function createAtaIfMissing(
  market: MintMarket,
  payer: PublicKey,
  address: PublicKey,
  owner: PublicKey,
  exists: boolean,
): TransactionInstruction | null {
  if (exists) return null
  return createAssociatedTokenAccountIdempotentInstruction(
    payer,
    address,
    owner,
    market.xnftMint,
    market.tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )
}

function transfer(
  market: MintMarket,
  source: PublicKey,
  destination: PublicKey,
  authority: PublicKey,
  amount: bigint,
): TransactionInstruction {
  return createTransferCheckedInstruction(
    source,
    market.xnftMint,
    destination,
    authority,
    amount,
    market.decimals,
    [],
    market.tokenProgram,
  )
}

// ---------------------------------------------------------------------------
// Instruction composition — pure given a Market, so a test can read every byte
// ---------------------------------------------------------------------------

/**
 * The transfer a mint IS — singular. 10,000 $xNFT from the buyer to the project
 * wallet, and that is the entire economic content of a mint.
 *
 * This was a burn to the incinerator and is now revenue. The mechanics are
 * identical — one `transferChecked`, same amount, same decimals — but the claim
 * the interface may make about it is not, and nothing in the app may describe
 * this as burning tokens. Supply does not decrease. See Docs and Token.
 *
 * Returns one instruction rather than a one-element array, and that is not a
 * style choice. An earlier shape returned two, and an array is an invitation:
 * the fee leg came back by being pushed into it. A function whose return type
 * cannot hold a second transfer cannot quietly grow one.
 *
 * `owner` is still the only address a caller supplies and it is still the
 * *source*. The destination comes off the resolved market, which read it from a
 * module constant — so no call site can redirect where a mint pays.
 */
export function mintTransfer(market: MintMarket, owner: PublicKey): TransactionInstruction {
  return transfer(
    market,
    tokenAccountFor(market, owner),
    tokenAccountFor(market, market.proceeds),
    owner,
    mintAmount(market.decimals),
  )
}

/**
 * The two transfers a rental is: the owner's take and the protocol's 10%.
 *
 * The xployee itself does not move and is not referenced — a rental is a payment
 * plus a Supabase row saying who may point at whose sheet until when. There is
 * nothing here for an escrow to have held.
 */
export function rentTransfers(
  market: Market,
  renter: PublicKey,
  owner: PublicKey,
  feePerEpoch: bigint,
  termEpochs: number,
): TransactionInstruction[] {
  const quote = quoteRent(feePerEpoch, termEpochs)
  const source = tokenAccountFor(market, renter)
  return [
    transfer(market, source, tokenAccountFor(market, owner), renter, quote.gross),
    transfer(market, source, tokenAccountFor(market, market.treasury), renter, quote.fee),
  ]
}

/**
 * The claim: treasury ATA to dev-wallet ATA, signed by the treasury wallet.
 *
 * Read the guarantee here carefully, because it is smaller than the one the
 * program made. The token program will enforce that only the treasury keypair can
 * move this balance — that much is real. What no longer exists is anything
 * enforcing *where* it goes. `config.dev_wallet` used to be an on-chain address
 * constraint; now the destination is a constant in a file the operator ships.
 * Whoever holds the treasury key can send the fees anywhere, and this function is
 * an authorization they perform, not a permission the chain grants them.
 *
 * Keeping the destination out of the parameter list is therefore worth *less*
 * than it used to be, and still worth doing: it means no call site, and no bug in
 * one, can redirect a payout.
 */
export function claimTransfer(market: Market, amount: bigint): TransactionInstruction {
  return transfer(
    market,
    tokenAccountFor(market, market.treasury),
    tokenAccountFor(market, market.devWallet),
    market.treasury,
    amount,
  )
}

// ---------------------------------------------------------------------------
// Balance reads
// ---------------------------------------------------------------------------

export interface TokenBalanceRead {
  rawAmount: bigint
  decimals: number
  /** Display only. Never feed this back into an amount. */
  uiAmount: number
  /** False when the owner has never held $xNFT — no associated token account exists. */
  exists: boolean
}

export interface TreasuryBalance extends TokenBalanceRead {
  /** The treasury's token account, so a UI can link a visitor at the actual balance. */
  address: PublicKey
}

/** Exact within a float's range because whole and fractional parts convert separately. */
function toUiAmount(raw: bigint, decimals: number): number {
  const base = 10n ** BigInt(decimals)
  return Number(raw / base) + Number(raw % base) / Number(base)
}

async function readBalance(
  connection: Connection,
  market: MintMarket,
  address: PublicKey,
): Promise<TokenBalanceRead | SplError> {
  try {
    const account = await getAccount(connection, address, undefined, market.tokenProgram)
    return {
      rawAmount: account.amount,
      decimals: market.decimals,
      uiAmount: toUiAmount(account.amount, market.decimals),
      exists: true,
    }
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError || e instanceof TokenInvalidAccountOwnerError) {
      return { rawAmount: 0n, decimals: market.decimals, uiAmount: 0, exists: false }
    }
    return rpcFail(e)
  }
}

/**
 * An owner's $xNFT balance. A missing token account is a zero balance with
 * `exists: false`, not an error — plenty of visitors have simply never held the
 * token. Only an unreachable RPC produces an SplError here, because reporting a
 * dead endpoint as a zero balance shows a shortfall that does not exist.
 */
export async function fetchOwnerBalance(
  owner: string,
  endpoint?: string,
): Promise<TokenBalanceRead | SplError> {
  // The mint gate, not the full one: reading a balance needs the token's address
  // and nothing else, and a visitor should not be told their balance is
  // unreadable because a payout wallet nobody is paying is unset.
  if (!isMintConfigured()) return fail('not-configured', MINT_NOT_CONFIGURED)

  const ownerKey = parseWallet(owner)
  if (!ownerKey) return fail('no-wallet', 'Connect a Solana wallet to read your $xNFT balance.')

  const connection = openConnection(endpoint)
  if (isSplError(connection)) return connection

  const market = await resolveMintMarket(connection)
  if (isSplError(market)) return market

  return readBalance(connection, market, tokenAccountFor(market, ownerKey))
}

/**
 * The treasury's live balance, read straight off the token account.
 *
 * This is what the Payouts desk shows as claimable, and it is deliberately the
 * account balance rather than a running total of fees minus claims: with no
 * program keeping counters, the token account is the only thing that knows how
 * much money is actually there.
 */
export async function fetchTreasuryBalance(endpoint?: string): Promise<TreasuryBalance | SplError> {
  if (!isConfigured()) return fail('not-configured', NOT_CONFIGURED)

  const connection = openConnection(endpoint)
  if (isSplError(connection)) return connection

  const market = await resolveMarket(connection)
  if (isSplError(market)) return market

  const address = tokenAccountFor(market, market.treasury)
  const balance = await readBalance(connection, market, address)
  if (isSplError(balance)) return balance
  return { ...balance, address }
}

// ---------------------------------------------------------------------------
// Transaction builders
// ---------------------------------------------------------------------------

export interface TxOptions {
  endpoint?: string
}

async function withBlockhash(
  connection: Connection,
  tx: Transaction,
  feePayer: PublicKey,
): Promise<Transaction | SplError> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
    tx.recentBlockhash = blockhash
    tx.lastValidBlockHeight = lastValidBlockHeight
    tx.feePayer = feePayer
    return tx
  } catch (e) {
    return rpcFail(e)
  }
}

/**
 * Checks a payer can cover a total before anything is built, and returns the
 * shortfall as data rather than as a transaction the wallet will reject.
 */
async function requireBalance(
  connection: Connection,
  market: MintMarket,
  payer: PublicKey,
  total: bigint,
  emptyMessage: string,
  shortMessage: string,
): Promise<SplError | null> {
  const balance = await readBalance(connection, market, tokenAccountFor(market, payer))
  if (isSplError(balance)) return balance
  if (!balance.exists) return short('no-token-account', emptyMessage, total, market.decimals)
  if (balance.rawAmount < total) {
    return short('insufficient-balance', shortMessage, total - balance.rawAmount, market.decimals)
  }
  return null
}

/**
 * The unsigned mint transaction: 10,000 $xNFT to the incinerator, under one
 * signature, and nothing else in it.
 *
 * The instruction list is at most two long and only one of them moves value —
 * the idempotent create for the incinerator's token account, which is skipped
 * once that account exists and will never be needed again after the first mint
 * anyone performs.
 *
 * Everything that could refuse does so before the transaction exists — an
 * unconfigured build, an off-curve wallet, a shortfall — so an underfunded
 * visitor reads a sentence instead of dismissing a wallet prompt they should
 * never have seen. There is no u64 check here because there cannot be a mint to
 * check: `resolveMintMarket` refuses any decimals count at which the amount would
 * not encode, so by this line the figure is provably sendable.
 */
export async function buildMintTransaction(
  owner: string,
  options: TxOptions = {},
): Promise<Transaction | SplError> {
  if (!isMintConfigured()) return fail('not-configured', MINT_NOT_CONFIGURED)

  const ownerKey = parseWallet(owner)
  if (!ownerKey) return fail('no-wallet', 'Connect a Solana wallet before minting.')

  const connection = openConnection(options.endpoint)
  if (isSplError(connection)) return connection

  const market = await resolveMintMarket(connection)
  if (isSplError(market)) return market

  const amount = mintAmount(market.decimals)
  const shortfall = await requireBalance(
    connection,
    market,
    ownerKey,
    amount,
    'This wallet holds no $xNFT. Minting burns the mint cost outright.',
    'Not enough $xNFT to cover the mint.',
  )
  if (shortfall) return shortfall

  const incinerator = incineratorTokenAccount(market)
  const incineratorExists = await tokenAccountExists(connection, market, incinerator)
  if (isSplError(incineratorExists)) return incineratorExists

  const tx = new Transaction()
  // Create first: a transfer into an account that does not exist yet fails, and
  // instructions execute in order within a transaction.
  const open = createAtaIfMissing(market, ownerKey, incinerator, incineratorKey, incineratorExists)
  if (open) tx.add(open)
  tx.add(mintTransfer(market, ownerKey))

  return withBlockhash(connection, tx, ownerKey)
}

/**
 * Everything wrong with a rental's *amounts*, decided without a wallet, a network
 * or a configured deployment.
 *
 * Pure and exported because it is the only place the rent path's u64 ceiling
 * lives, and a check that can only be reached through a configured build is a
 * check nobody can test. The mint path needs no equivalent: its amount is fixed,
 * so `resolveMintMarket` bounds it once via MAX_MINT_DECIMALS and any mint that
 * resolves at all is provably encodable. A rental's amount is `feePerEpoch x
 * term` with both halves supplied by the caller, which no decimals guard can
 * bound — and until this existed, nothing bounded it at all.
 *
 * That gap was not an exception waiting to be thrown.
 * `createTransferCheckedInstruction` takes an amount too large for its u64 field,
 * encodes the low 64 bits, and returns a perfectly well-formed instruction for a
 * different quantity of real tokens. A renter could have been quoted an enormous
 * contract and signed one for pocket change, or the reverse, with no error
 * anywhere. Refusing before the transaction exists is the only defence.
 *
 * The ceiling is checked on `total`, which covers both legs: gross and fee are
 * each strictly below it.
 */
export function rentRequestError(feePerEpoch: bigint, termEpochs: number): SplError | null {
  if (feePerEpoch < 0n) return fail('invalid-request', 'A rental fee cannot be negative.')
  if (!Number.isInteger(termEpochs) || termEpochs <= 0) {
    return fail('invalid-request', 'A rental term has to be a whole number of epochs, at least one.')
  }

  const quote = quoteRent(feePerEpoch, termEpochs)
  if (quote.total <= 0n) return fail('invalid-request', 'A rental has to cost more than zero.')
  if (quote.total > U64_MAX) {
    return fail(
      'invalid-request',
      'That rental is larger than an SPL token transfer can carry. No transaction was built.',
    )
  }
  return null
}

/**
 * The unsigned rental payment: `feePerEpoch × term` to the owner and 10% of that
 * to the treasury, under one signature.
 *
 * `owner` is a counterparty, not a destination the module owns — the renter is
 * paying a specific person for a specific xployee, and which person that is comes
 * from the listing. The treasury leg is the one this module pins, and it is not a
 * parameter. Nothing about the xployee changes hands, on-chain or otherwise;
 * tenancy is a Supabase row.
 */
export async function buildRentTransaction(
  renter: string,
  owner: string,
  feePerEpoch: bigint,
  termEpochs: number,
  options: TxOptions = {},
): Promise<Transaction | SplError> {
  if (!isConfigured()) return fail('not-configured', NOT_CONFIGURED)

  const renterKey = parseWallet(renter)
  if (!renterKey) return fail('no-wallet', 'Connect a Solana wallet before renting.')
  const ownerKey = parseWallet(owner)
  if (!ownerKey) return fail('invalid-request', "That xployee's owner is not an ordinary wallet address.")
  // A self-rental would debit the renter the protocol fee to move tokens between
  // two of their own accounts. There is no version of that the visitor wants.
  if (ownerKey.equals(renterKey)) return fail('invalid-request', 'You cannot rent an xployee from yourself.')

  const invalid = rentRequestError(feePerEpoch, termEpochs)
  if (invalid) return invalid

  const quote = quoteRent(feePerEpoch, termEpochs)

  const connection = openConnection(options.endpoint)
  if (isSplError(connection)) return connection

  const market = await resolveMarket(connection)
  if (isSplError(market)) return market

  const shortfall = await requireBalance(
    connection,
    market,
    renterKey,
    quote.total,
    'This wallet holds no $xNFT. Renting costs the term price plus the protocol fee.',
    'Not enough $xNFT to cover the rental plus the protocol fee.',
  )
  if (shortfall) return shortfall

  const ownerAta = tokenAccountFor(market, ownerKey)
  const treasury = tokenAccountFor(market, market.treasury)

  const ownerExists = await tokenAccountExists(connection, market, ownerAta)
  if (isSplError(ownerExists)) return ownerExists
  const treasuryExists = await tokenAccountExists(connection, market, treasury)
  if (isSplError(treasuryExists)) return treasuryExists

  const tx = new Transaction()
  const opens = [
    createAtaIfMissing(market, renterKey, ownerAta, ownerKey, ownerExists),
    createAtaIfMissing(market, renterKey, treasury, market.treasury, treasuryExists),
  ]
  for (const ix of opens) if (ix) tx.add(ix)
  for (const ix of rentTransfers(market, renterKey, ownerKey, feePerEpoch, termEpochs)) tx.add(ix)

  return withBlockhash(connection, tx, renterKey)
}

/**
 * The unsigned claim. `amount` is raw units and is checked against the live
 * treasury balance here, so a stale UI figure is refused before the wallet is
 * asked rather than after.
 *
 * `operator` is checked to be the treasury wallet, and that check is not a
 * permission system — it is this module declining to build a transaction the
 * token program would certainly reject, because only the treasury keypair can
 * move the treasury's tokens. The destination is not a parameter and never
 * becomes one.
 */
export async function buildClaimTransaction(
  operator: string,
  amount: bigint,
  options: TxOptions = {},
): Promise<Transaction | SplError> {
  if (!isConfigured()) return fail('not-configured', NOT_CONFIGURED)

  const operatorKey = parseWallet(operator)
  if (!operatorKey) return fail('no-wallet', 'Connect the treasury wallet before claiming.')
  if (amount <= 0n) return fail('invalid-request', 'A claim has to be for more than zero.')

  const connection = openConnection(options.endpoint)
  if (isSplError(connection)) return connection

  const market = await resolveMarket(connection)
  if (isSplError(market)) return market

  if (!market.treasury.equals(operatorKey)) {
    return fail(
      'not-operator',
      'This wallet does not own the treasury token account, so the transfer would be rejected.',
    )
  }

  const treasuryAta = tokenAccountFor(market, market.treasury)
  const balance = await readBalance(connection, market, treasuryAta)
  if (isSplError(balance)) return balance
  if (!balance.exists) {
    return fail('no-token-account', 'The treasury holds no $xNFT account yet; no fees have ever landed.')
  }
  if (amount > balance.rawAmount) {
    return short(
      'insufficient-balance',
      'That claim is larger than the treasury holds.',
      amount - balance.rawAmount,
      market.decimals,
    )
  }

  const devAta = tokenAccountFor(market, market.devWallet)
  const devExists = await tokenAccountExists(connection, market, devAta)
  if (isSplError(devExists)) return devExists

  const tx = new Transaction()
  const open = createAtaIfMissing(market, operatorKey, devAta, market.devWallet, devExists)
  if (open) tx.add(open)
  tx.add(claimTransfer(market, amount))

  return withBlockhash(connection, tx, operatorKey)
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

/**
 * Bounded polling instead of a websocket subscription — public RPC often refuses
 * WS upgrades. Exported so a test can compute the exact horizon rather than guess
 * at one.
 */
export const CONFIRM_ATTEMPTS = 30
export const CONFIRM_DELAY_MS = 2_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Whether the transaction is provably dead: its blockhash can no longer be
 * accepted by any validator, and the cluster has still never heard of the
 * signature.
 *
 * Both halves are required, and each one alone would be a lie in a different
 * direction. Height past `lastValidBlockHeight` on its own says nothing — the
 * transaction may have landed in the last block that would take it, with the
 * status merely lagging. A missing status on its own says nothing either — until
 * the blockhash expires it is still perfectly sendable and may land a second
 * from now.
 *
 * The second read is deliberately widened with `searchTransactionHistory`. It is
 * the read that decides whether someone is told their money did not move, so it
 * gets the expensive lookup that the per-attempt polling above cannot afford.
 *
 * Anything that fails to answer — an RPC error on either call — returns false. A
 * dead endpoint is not evidence of a dead transaction, and the cost of guessing
 * wrong here is a visitor re-sending an irreversible burn.
 */
async function expiredWithoutLanding(
  connection: Connection,
  signature: string,
  lastValidBlockHeight: number,
): Promise<boolean> {
  try {
    // 'confirmed' to match the commitment withBlockhash read the height under, so
    // the two numbers are measured against the same fork.
    const height = await connection.getBlockHeight('confirmed')
    if (height <= lastValidBlockHeight) return false
  } catch {
    return false
  }

  try {
    const { value } = await connection.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    })
    return value === null
  } catch {
    return false
  }
}

/**
 * Polls for confirmation, and distinguishes the two ways a poll can end without a
 * confirmation — because they are opposite facts wearing the same silence.
 *
 * Resolves to an SplError in exactly two cases: the chain reports the transaction
 * itself failed, or the blockhash it was signed under expired while the cluster
 * never saw the signature. Both mean nothing moved, and both are safe to retry.
 *
 * Everything else resolves to null and is treated as success by the caller. A
 * plain timeout is success-with-unknown-status, never failure: a transaction that
 * may have landed must not be presented as a failure the visitor could "retry",
 * because the retry is a second burn. `lastValidBlockHeight` is what withBlockhash
 * stamped on the Transaction; without it there is no expiry to prove and this
 * degrades to exactly the old timeout-only behaviour.
 */
export async function confirmSignature(
  connection: Connection,
  signature: string,
  failureMessage: string,
  expiredMessage: string,
  lastValidBlockHeight?: number,
): Promise<SplError | null> {
  for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
    // Starts true so that a status read which throws is treated as "the cluster
    // did not answer", not as "the cluster has never heard of it". Only a reply
    // of null is evidence of absence.
    let seen = true
    try {
      const { value } = await connection.getSignatureStatus(signature)
      if (value?.err) return fail('network', failureMessage)
      if (value?.confirmationStatus === 'confirmed' || value?.confirmationStatus === 'finalized') {
        return null
      }
      seen = value !== null
    } catch {
      // A flaky status read is not a failed transaction — keep polling.
    }

    // Only worth asking when the signature is still unknown. A transaction the
    // cluster has already processed cannot expire out from under itself, and
    // asking anyway would spend a request to reach a `false` we already know.
    if (!seen && lastValidBlockHeight !== undefined) {
      if (await expiredWithoutLanding(connection, signature, lastValidBlockHeight)) {
        return fail('network', expiredMessage)
      }
    }

    await sleep(CONFIRM_DELAY_MS)
  }
  return null
}

/** Wallets share no error contract, so a dismissal has to be recognised by shape and by wording. */
const REJECTED = /reject|declin|denied|cancel|user.{0,3}abort/i

export function classifySendError(e: unknown, action: string): SplError {
  const message = e instanceof Error ? e.message : typeof e === 'string' ? e : ''
  // 4001 is the EIP-1193 "user rejected" code that Phantom and Backpack echo.
  const code = typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined
  if (code === 4001 || REJECTED.test(message)) {
    return fail('rejected', `${action} cancelled — nothing was sent.`)
  }
  if (!message) return fail('unknown', `The wallet failed to send the ${action.toLowerCase()}.`)
  return fail('network', `The ${action.toLowerCase()} was not sent: ${message}`)
}

/**
 * Signs, sends and confirms. Shared by all three send paths so the rule that a
 * signature is never downgraded to an error lives in one place: once the wallet
 * has returned one, the transaction is on the wire and only the chain's own
 * verdict may call it a failure.
 *
 * Signing is delegated — `signAndSend` is the wallet's own method, so no key
 * material passes through this module.
 */
async function signSendConfirm(
  connection: Connection,
  tx: Transaction,
  signAndSend: (tx: Transaction) => Promise<string>,
  action: string,
  failureMessage: string,
): Promise<{ signature: string } | SplError> {
  let signature: string
  try {
    signature = await signAndSend(tx)
  } catch (e) {
    return classifySendError(e, action)
  }

  if (typeof signature !== 'string' || signature.length === 0) {
    return fail('unknown', 'The wallet returned no transaction signature.')
  }

  // The expiry deadline withBlockhash stamped on this very transaction. Reading
  // it off the object rather than re-fetching a height keeps the number tied to
  // the blockhash that was actually signed — a second getLatestBlockhash would
  // measure a different one.
  const confirmError = await confirmSignature(
    connection,
    signature,
    failureMessage,
    `${action} expired before it reached the chain: its blockhash is no longer valid and no transaction with that signature exists. Nothing moved, and sending again is safe.`,
    tx.lastValidBlockHeight,
  )
  if (confirmError) return confirmError

  return { signature }
}

/**
 * Signs and sends the mint. Call this from a click handler and nowhere else — the
 * transfer is irreversible.
 */
export async function sendMint(
  owner: string,
  signAndSend: (tx: Transaction) => Promise<string>,
  options: TxOptions = {},
): Promise<{ signature: string } | SplError> {
  if (!isMintConfigured()) return fail('not-configured', MINT_NOT_CONFIGURED)

  const built = await buildMintTransaction(owner, options)
  if (isSplError(built)) return built

  const connection = openConnection(options.endpoint)
  if (isSplError(connection)) return connection

  return signSendConfirm(
    connection,
    built,
    signAndSend,
    'Mint',
    'The mint transaction failed on-chain. No $xNFT left your wallet.',
  )
}

/** Signs and sends a rental payment. Wire it to a click; it moves real value. */
export async function sendRent(
  renter: string,
  owner: string,
  feePerEpoch: bigint,
  termEpochs: number,
  signAndSend: (tx: Transaction) => Promise<string>,
  options: TxOptions = {},
): Promise<{ signature: string } | SplError> {
  if (!isConfigured()) return fail('not-configured', NOT_CONFIGURED)

  const built = await buildRentTransaction(renter, owner, feePerEpoch, termEpochs, options)
  if (isSplError(built)) return built

  const connection = openConnection(options.endpoint)
  if (isSplError(connection)) return connection

  return signSendConfirm(
    connection,
    built,
    signAndSend,
    'Rental',
    'The rental payment failed on-chain. No $xNFT left your wallet.',
  )
}

/**
 * Signs and sends a treasury claim. The caller records the signature the instant
 * it exists — see usePayouts — because from that moment the signature is the only
 * proof the money moved.
 */
export async function sendClaim(
  operator: string,
  amount: bigint,
  signAndSend: (tx: Transaction) => Promise<string>,
  options: TxOptions = {},
): Promise<{ signature: string } | SplError> {
  if (!isConfigured()) return fail('not-configured', NOT_CONFIGURED)

  const built = await buildClaimTransaction(operator, amount, options)
  if (isSplError(built)) return built

  const connection = openConnection(options.endpoint)
  if (isSplError(connection)) return connection

  return signSendConfirm(
    connection,
    built,
    signAndSend,
    'Claim',
    'The claim failed on-chain. Nothing left the treasury.',
  )
}
