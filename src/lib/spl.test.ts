// ./spl composes plain SPL Token instructions, so there are no discriminators or
// account orders to drift — the token program owns those. What can go wrong here
// is different, and narrower:
//
//   - the mint stops being exactly one transfer of 10,000, or grows a fee back,
//   - a destination becomes something a caller can influence,
//   - an ATA is derived under the wrong curve rule or the wrong token program,
//   - an amount passes through a float on its way to a u64, or past one,
//   - the unconfigured gate stops covering some path,
//   - the rent fee grows a second implementation that rounds differently.
//
// Every test below is one of those six. All of it is offline: the deployment
// constants are still empty placeholders, so the network paths are exercised only
// to prove they refuse, and the instruction composers are exercised against a
// synthetic Market the test constructs itself.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Keypair, PublicKey, TransactionInstruction, type Connection } from '@solana/web3.js'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenOwnerOffCurveError,
  decodeTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  MINT_BURN,
  SIM_RENT_FEE_BPS,
  SIM_SALE_FEE_BPS,
  feeOn,
  mintAmount,
  rentQuote,
  toRawUnits,
} from './fees'
import {
  CONFIRM_ATTEMPTS,
  CONFIRM_DELAY_MS,
  DEFAULT_RPC,
  getConnection,
  resolveRpcEndpoint,
  devWalletAddress,
  INCINERATOR_ADDRESS,
  MAX_MINT_DECIMALS,
  treasuryAddress,
  U64_MAX as SPL_U64_MAX,
  xnftMintAddress,
  buildClaimTransaction,
  buildMintTransaction,
  buildRentTransaction,
  claimTransfer,
  classifySendError,
  confirmSignature,
  fetchOwnerBalance,
  fetchTreasuryBalance,
  incineratorTokenAccount,
  isConfigured,
  isMintConfigured,
  isSplError,
  mintTransfer,
  quoteRent,
  rentRequestError,
  rentTransfers,
  sendClaim,
  sendMint,
  sendRent,
  tokenAccountFor,
  type Market,
  type MintMarket,
} from './spl'
import {

  MINT_COST,
  buildBurnTransaction,
  fetchXnftBalance,
  isBurnConfigured,
  isBurnError,
  sendBurn,
} from './solana'
import { __setRuntimeConfigForTests, __resetRuntimeConfigForTests } from './runtimeConfig'

/* ---- Fixtures ------------------------------------------------------------ */

const key = () => Keypair.generate().publicKey

/** The width of an SPL token amount. Everything about the decimals ceiling is this number. */
const U64_MAX = 2n ** 64n - 1n

const XNFT_MINT = key()
const TREASURY = key()
const DEV_WALLET = key()
const INCINERATOR = new PublicKey(INCINERATOR_ADDRESS)

function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    xnftMint: XNFT_MINT,
    treasury: TREASURY,
    devWallet: DEV_WALLET,
    // A mint pays the project wallet, which is the same address the dev wallet
    // holds. They are separate fields because they answer to different things:
    // `proceeds` is where a buyer's money lands, `devWallet` is where a payout
    // claim sends the treasury. Collapsing them would make a future split of the
    // two a schema change instead of a config change.
    proceeds: DEV_WALLET,
    tokenProgram: TOKEN_PROGRAM_ID,
    decimals: 9,
    ...overrides,
  }
}

const market = makeMarket()

const ata = (
  owner: PublicKey,
  offCurve = false,
  tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
) => getAssociatedTokenAddressSync(XNFT_MINT, owner, offCurve, tokenProgram, ASSOCIATED_TOKEN_PROGRAM_ID)

/** A transferChecked reduced to the four facts a money test cares about. */
function readTransfer(ix: TransactionInstruction, tokenProgram = TOKEN_PROGRAM_ID) {
  const decoded = decodeTransferCheckedInstruction(ix, tokenProgram)
  return {
    source: decoded.keys.source.pubkey.toBase58(),
    destination: decoded.keys.destination.pubkey.toBase58(),
    authority: decoded.keys.owner.pubkey.toBase58(),
    mint: decoded.keys.mint.pubkey.toBase58(),
    amount: decoded.data.amount,
    decimals: decoded.data.decimals,
  }
}

/** Every async entry point, uniformly callable, for the gate sweep. */
const NEVER_SIGNS = async (): Promise<string> => {
  throw new Error('the gate let a build through and the wallet was asked to sign')
}

/* ---- The mint: one transfer of 10,000, and no second leg ----------------- */

describe('mint instruction set', () => {
  // The headline change. A mint used to be two transfers, 10,000 burned plus a
  // 500 fee to the treasury. It is one transfer now, and `mintTransfer` returns a
  // single instruction rather than an array precisely so a second leg cannot be
  // pushed back in without changing the signature — which this test would see.
  it('is one transfer and returns it as one instruction, not a list', () => {
    const ix = mintTransfer(market, key())
    expect(ix).toBeInstanceOf(TransactionInstruction)
    expect(Array.isArray(ix)).toBe(false)
  })

  it('burns 10,000 and debits nothing else', () => {
    const owner = key()
    const burn = readTransfer(mintTransfer(market, owner))
    const unit = 10n ** 9n

    expect(burn.amount).toBe(10_000n * unit)
    expect(burn.amount).toBe(MINT_BURN * unit)
    expect(burn.amount).toBe(mintAmount(9))
  })

  it('takes the transfer from the buyer and nowhere else', () => {
    const owner = key()
    const t = readTransfer(mintTransfer(market, owner))
    expect(t.source).toBe(ata(owner).toBase58())
    expect(t.authority).toBe(owner.toBase58())
    expect(t.mint).toBe(XNFT_MINT.toBase58())
    expect(t.decimals).toBe(9)
  })

  it('sends every token to the project wallet and none to the treasury', () => {
    const paid = readTransfer(mintTransfer(market, key()))
    expect(paid.destination).toBe(ata(DEV_WALLET).toBase58())
    expect(paid.destination).not.toBe(ata(TREASURY).toBase58())
    // Explicitly NOT the incinerator any more. A mint is revenue, not a burn.
    expect(paid.destination).not.toBe(ata(INCINERATOR, true).toBase58())
  })

  // The fee used to ride on top of the burn. It does not ride anywhere now, and
  // the assertion that matters is not "the fee is zero" — it is that the amount
  // the incinerator receives is the whole debit, with no 5% anywhere in it.
  it('leaves no 5% of the burn hiding anywhere in the transaction', () => {
    const burn = readTransfer(mintTransfer(market, key()))
    const wouldHaveBeenFee = feeOn(burn.amount, SIM_SALE_FEE_BPS)
    expect(wouldHaveBeenFee).toBe(500n * 10n ** 9n)
    // The old shape: 10,000 to the incinerator and this on top. Neither the
    // amount nor a second instruction exists to carry it.
    expect(burn.amount).not.toBe(mintAmount(9) - wouldHaveBeenFee)
    expect(burn.amount + wouldHaveBeenFee).toBe(10_500n * 10n ** 9n)
    expect(burn.amount).toBe(10_000n * 10n ** 9n)
  })

  it('agrees with the whole-token constant solana.ts prints', () => {
    expect(MINT_COST).toBe(10_000)
    expect(mintAmount(9)).toBe(BigInt(MINT_COST) * 10n ** 9n)
  })

  it('needs nothing from the market but the token and where proceeds go', () => {
    // A MintMarket carries no treasury, which is the type-level statement that a
    // mint cannot pay one — if the protocol fee ever returns, this fixture stops
    // compiling before any assertion runs. It DOES carry `proceeds`, because a
    // mint now has exactly one payee and no default for it would be safe.
    const mintOnly: MintMarket = {
      xnftMint: XNFT_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      decimals: 9,
      proceeds: DEV_WALLET,
    }
    expect(readTransfer(mintTransfer(mintOnly, key())).amount).toBe(mintAmount(9))
  })

  it('sends the whole mint to the project wallet, not the incinerator', () => {
    // The change from burn to revenue, pinned. Nothing about the amount or the
    // instruction shape moved; only the destination did, and a test that only
    // checked the amount would have passed through the entire change.
    const market = makeMarket()
    const buyer = key()
    const ix = mintTransfer(market, buyer)
    const t = readTransfer(ix)
    const projectAta = getAssociatedTokenAddressSync(XNFT_MINT, DEV_WALLET, false, TOKEN_PROGRAM_ID)
    const incineratorAta = getAssociatedTokenAddressSync(XNFT_MINT, INCINERATOR, true, TOKEN_PROGRAM_ID)
    expect(String(t.destination)).toBe(projectAta.toBase58())
    expect(String(t.destination)).not.toBe(incineratorAta.toBase58())
    expect(t.amount).toBe(mintAmount(9))
  })

  it('delegates the amount to fees.ts rather than recomputing it', () => {
    for (const decimals of [0, 1, 6, 9, 12]) {
      const t = readTransfer(mintTransfer(makeMarket({ decimals }), key()))
      expect(t.amount).toBe(mintAmount(decimals))
    }
  })
})

/* ---- The destination is not negotiable ----------------------------------- */

describe('mint destination', () => {
  it('is the project wallet, and the incinerator constant no longer receives it', () => {
    expect(INCINERATOR_ADDRESS).toBe('1nc1nerator11111111111111111111111111111111')
    // The constant survives so the address is documented somewhere, but nothing
    // pays it. If a future change routes a mint back to it, the assertion below
    // fails rather than the interface quietly starting to burn again.
    expect(readTransfer(mintTransfer(market, key())).destination).not.toBe(
      ata(INCINERATOR, true).toBase58(),
    )
  })

  it('never varies with the owner a caller supplies', () => {
    const expected = ata(DEV_WALLET).toBase58()
    for (let i = 0; i < 8; i++) {
      expect(readTransfer(mintTransfer(market, key())).destination).toBe(expected)
    }
  })

  // The structural half of the guarantee. A destination that is not in the
  // parameter list cannot be redirected by a caller, an extra argument, or a bug
  // at a call site — which is what turns a burn helper into an arbitrary-transfer
  // primitive. Arity is asserted because a future signature change is exactly the
  // thing that would reopen it.
  it('is not a parameter of any composer, even when one is smuggled in', () => {
    expect(mintTransfer).toHaveLength(2)
    expect(incineratorTokenAccount).toHaveLength(1)
    expect(claimTransfer).toHaveLength(2)

    const owner = key()
    const attacker = key()
    const honest = readTransfer(mintTransfer(market, owner))
    const smuggled = readTransfer(
      (
        mintTransfer as unknown as (
          m: Market,
          o: PublicKey,
          ...rest: PublicKey[]
        ) => TransactionInstruction
      )(market, owner, attacker, attacker),
    )

    expect(smuggled).toEqual(honest)
    expect(smuggled.destination).not.toBe(ata(attacker).toBase58())
  })

  // A mint no longer has a configurable destination at all — the incinerator is a
  // module constant. The Market still carries the treasury and dev wallet for the
  // two paths that pay them, and it is built from module configuration by a
  // function no caller reaches. A test can forge one; the async builders cannot.
  it('reads the rental and payout destinations from the market, not the arguments', () => {
    const other = makeMarket({ treasury: key(), devWallet: key() })
    const [, fee] = rentTransfers(other, key(), key(), 100n, 2).map((ix) => readTransfer(ix))
    expect(fee.destination).toBe(
      getAssociatedTokenAddressSync(
        XNFT_MINT,
        other.treasury,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ).toBase58(),
    )

    const claim = readTransfer(claimTransfer(other, 1n))
    expect(claim.destination).toBe(
      getAssociatedTokenAddressSync(
        XNFT_MINT,
        other.devWallet,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ).toBase58(),
    )
  })
})

/* ---- ATA derivation, including the off-curve asymmetry -------------------- */

describe('associated token accounts', () => {
  it('derives an ordinary wallet ATA the same way spl-token does', () => {
    const owner = key()
    expect(tokenAccountFor(market, owner).toBase58()).toBe(ata(owner).toBase58())
  })

  // The asymmetry that makes the burn work. The incinerator is off the ed25519
  // curve, so the default derivation refuses it; every other owner in the module
  // keeps the guard, because an off-curve "wallet" cannot sign tokens back out.
  it('refuses an off-curve owner through the wallet derivation', () => {
    expect(PublicKey.isOnCurve(INCINERATOR.toBytes())).toBe(false)
    expect(() => tokenAccountFor(market, INCINERATOR)).toThrow(TokenOwnerOffCurveError)
  })

  it('relaxes the guard only for the incinerator, and lands on the same address', () => {
    expect(incineratorTokenAccount(market).toBase58()).toBe(ata(INCINERATOR, true).toBase58())
  })

  it('derives under the mint’s own token program rather than a default', () => {
    const owner = key()
    const classic = tokenAccountFor(market, owner)
    const token2022 = tokenAccountFor(makeMarket({ tokenProgram: TOKEN_2022_PROGRAM_ID }), owner)

    // Different program id, different ATA. Assuming TOKEN_PROGRAM_ID for a
    // Token-2022 mint would point every transfer at an account that does not
    // exist, which is why resolveMarket reads the owner off the mint account.
    expect(token2022.toBase58()).not.toBe(classic.toBase58())
    expect(token2022.toBase58()).toBe(ata(owner, false, TOKEN_2022_PROGRAM_ID).toBase58())
    expect(incineratorTokenAccount(makeMarket({ tokenProgram: TOKEN_2022_PROGRAM_ID })).toBase58()).toBe(
      ata(INCINERATOR, true, TOKEN_2022_PROGRAM_ID).toBase58(),
    )
  })

  it('stamps the transfer with the market’s token program', () => {
    const t2022 = makeMarket({ tokenProgram: TOKEN_2022_PROGRAM_ID })
    const ix = mintTransfer(t2022, key())
    expect(ix.programId.toBase58()).toBe(TOKEN_2022_PROGRAM_ID.toBase58())
    // Decoding under the classic program would be a silent mismatch on-chain.
    expect(() => decodeTransferCheckedInstruction(ix, TOKEN_PROGRAM_ID)).toThrow()
  })
})

/* ---- Decimals scaling stays in bigint ------------------------------------ */

describe('decimals scaling', () => {
  it('scales the mint exactly at every plausible decimal count', () => {
    for (let decimals = 0; decimals <= 18; decimals++) {
      expect(mintAmount(decimals)).toBe(10_000n * 10n ** BigInt(decimals))
    }
  })

  // At 18 decimals the debit is 1e22 raw units, which is past
  // Number.MAX_SAFE_INTEGER by six orders of magnitude. This is the test that
  // says why money is bigint.
  //
  // Note the shape of the assertion. 1e22 happens to be exactly representable as
  // a double — it is 2^22 x 5^22 and 5^22 fits a mantissa — so a naive
  // round-trip check would pass on this particular figure and prove nothing. What
  // is actually broken at that magnitude is the *spacing*: consecutive doubles
  // are about 2 million raw units apart, so a float cannot tell this amount from
  // one two million units larger, and any arithmetic done in floats up here
  // silently snaps to the nearest representable neighbour.
  it('holds a figure a float could not distinguish from its neighbours', () => {
    const amount = mintAmount(18)
    expect(amount).toBe(10_000n * 10n ** 18n)
    expect(amount > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true)

    expect(Number(amount + 1n)).toBe(Number(amount))
    expect(Number(amount + 1_000_000n)).toBe(Number(amount))
    expect(amount + 1n).not.toBe(amount)
    // The first neighbour a double can actually name is millions of units away.
    expect(BigInt(Number(amount + 1n))).not.toBe(amount + 1n)
  })

  it('carries the scaled amount into the instruction without narrowing it', () => {
    // MAX_MINT_DECIMALS rather than 18 only because 10,000 x 10^16 overflows the
    // u64 a token amount actually is. The arithmetic above is still exact; this is
    // the largest scale the token program itself can carry, and it is read from
    // the module so raising MINT_BURN moves this test with it.
    const decimals = MAX_MINT_DECIMALS
    const burn = readTransfer(mintTransfer(makeMarket({ decimals }), key()))
    expect(burn.amount).toBe(10_000n * 10n ** BigInt(decimals))
    expect(burn.decimals).toBe(decimals)
    expect(burn.amount).toBeLessThanOrEqual(U64_MAX)
  })

  it('exports the same u64 width the tests measure against', () => {
    // The module's own ceiling, so a rent check and a decimals scan cannot drift
    // apart from the number this file believes a token amount is.
    expect(SPL_U64_MAX).toBe(U64_MAX)
  })
})

/* ---- The u64 ceiling, and the silent truncation just past it ------------- */

// The hazard this guards is not an exception. `createTransferCheckedInstruction`
// takes an amount too large for its u64 field and encodes the bytes that fit,
// returning a perfectly well-formed instruction for a different quantity of real
// tokens. There is no error to catch, so the only defence is refusing the mint
// before it is built — which means the guard's ceiling and the encoder's ceiling
// have to be the same number.
describe('mint decimals ceiling', () => {
  it('is the last decimal count at which the whole debit fits a u64', () => {
    expect(mintAmount(MAX_MINT_DECIMALS)).toBeLessThanOrEqual(U64_MAX)
    expect(mintAmount(MAX_MINT_DECIMALS + 1)).toBeGreaterThan(U64_MAX)
  })

  // Derived from MINT_BURN rather than written down: 10,000 x 10^15 fits a u64
  // and 10,000 x 10^16 does not. The number is asserted so a silent drift is
  // visible, and the derivation is asserted above so changing the burn moves it.
  //
  // It is still 15 after the fee removal, which is worth stating: the debit fell
  // from 10,500 to 10,000, and both sit in the same decade, so the ceiling did
  // not move. That is a coincidence of magnitude, not an invariant — the loop in
  // ./spl is what makes it true rather than this number.
  it('lands on 15 for the current mint cost', () => {
    expect(MAX_MINT_DECIMALS).toBe(15)
    expect(10_000n * 10n ** 15n).toBeLessThanOrEqual(U64_MAX)
    expect(10_000n * 10n ** 16n).toBeGreaterThan(U64_MAX)
  })

  it('tracks MINT_BURN rather than a written-down constant', () => {
    // The property the derivation actually asserts, restated independently of the
    // module: the ceiling is the largest d with MINT_BURN x 10^d <= u64 max.
    let expected = -1
    for (let d = 0; d <= 18; d++) {
      if (MINT_BURN * 10n ** BigInt(d) > U64_MAX) break
      expected = d
    }
    expect(MAX_MINT_DECIMALS).toBe(expected)
    // And a heavier burn would genuinely narrow it, so the derivation is live.
    let heavier = -1
    for (let d = 0; d <= 18; d++) {
      if (MINT_BURN * 100n * 10n ** BigInt(d) > U64_MAX) break
      heavier = d
    }
    expect(heavier).toBeLessThan(MAX_MINT_DECIMALS)
  })

  it('stays inside what ./fees will compute at all', () => {
    // ./fees throws past 18, so a ceiling above it would trade a truncated amount
    // for a thrown RangeError out of a module that promises never to throw.
    expect(MAX_MINT_DECIMALS).toBeGreaterThanOrEqual(0)
    expect(MAX_MINT_DECIMALS).toBeLessThanOrEqual(18)
  })

  it('encodes exactly at the ceiling', () => {
    const burn = readTransfer(mintTransfer(makeMarket({ decimals: MAX_MINT_DECIMALS }), key()))
    expect(burn.amount).toBe(mintAmount(MAX_MINT_DECIMALS))
    expect(burn.amount).toBe(10_000n * 10n ** BigInt(MAX_MINT_DECIMALS))
  })

  // The exact decimal at which the encoder starts lying: one past the ceiling.
  // Note what does NOT happen — no throw, no error return, just a smaller number
  // in a valid instruction. That is the whole reason the guard cannot be wider
  // than this.
  it('truncates silently at the first decimal past the ceiling', () => {
    const decimals = MAX_MINT_DECIMALS + 1
    const intended = mintAmount(decimals)
    expect(intended).toBeGreaterThan(U64_MAX)

    const burn = readTransfer(mintTransfer(makeMarket({ decimals }), key()))
    // It did not refuse. It encoded something else and said nothing.
    expect(burn.amount).not.toBe(intended)
    expect(burn.amount).toBeLessThanOrEqual(U64_MAX)
    expect(burn.decimals).toBe(decimals)
  })

  it('keeps truncating all the way to 18, which is why the guard is not 18', () => {
    for (let decimals = MAX_MINT_DECIMALS + 1; decimals <= 18; decimals++) {
      const burn = readTransfer(mintTransfer(makeMarket({ decimals }), key()))
      expect(burn.amount).not.toBe(mintAmount(decimals))
    }
  })
})

/* ---- The same ceiling on the rent path, which had none ------------------- */

// The asymmetry this closes: the mint path is bounded by a decimals guard, because
// its amount is fixed and a decimals count is the only free variable. A rental's
// amount is `feePerEpoch x term` with both halves supplied by the caller, so no
// decimals guard can bound it and until now nothing did — an oversized contract
// would have been encoded modulo 2^64 into a valid instruction for a different
// quantity of real tokens, with the quote on screen unchanged.
describe('rent u64 ceiling', () => {
  it('refuses a rental whose total cannot be encoded', () => {
    const error = rentRequestError(U64_MAX, 2)
    expect(isSplError(error)).toBe(true)
    // `invalid-request`, not `network` and not `unknown` — the arguments describe
    // a transfer that has no representation, which is the caller's bug.
    expect(error?.code).toBe('invalid-request')
  })

  /**
   * The boundary itself, found by construction rather than written down as a
   * magic literal — the largest single-epoch fee whose gross *plus fee* still
   * encodes, and the very next raw unit.
   *
   * The gap between those two is the whole point of checking `total` rather than
   * a leg: at the refused value the owner's leg still fits a u64 on its own, so a
   * per-leg check would have admitted it and silently truncated the fee.
   */
  it('refuses on the total, one raw unit past the largest rental that encodes', () => {
    let largest = (U64_MAX * 10n) / 11n
    while (quoteRent(largest + 1n, 1).total <= U64_MAX) largest += 1n
    const firstRefused = largest + 1n

    expect(quoteRent(largest, 1).total).toBeLessThanOrEqual(U64_MAX)
    expect(rentRequestError(largest, 1)).toBeNull()

    expect(quoteRent(firstRefused, 1).gross).toBeLessThanOrEqual(U64_MAX)
    expect(quoteRent(firstRefused, 1).total).toBeGreaterThan(U64_MAX)
    expect(rentRequestError(firstRefused, 1)?.code).toBe('invalid-request')
  })

  it('admits an ordinary rental without complaint', () => {
    expect(rentRequestError(1n, 1)).toBeNull()
    expect(rentRequestError(toRawUnits(12.5, 9), 30)).toBeNull()
  })

  it('still refuses the nonsense it always refused', () => {
    expect(rentRequestError(-1n, 1)?.code).toBe('invalid-request')
    expect(rentRequestError(1n, 0)?.code).toBe('invalid-request')
    expect(rentRequestError(1n, -1)?.code).toBe('invalid-request')
    expect(rentRequestError(1n, 2.5)?.code).toBe('invalid-request')
    // Zero per epoch over a real term costs nothing, so there is nothing to send.
    expect(rentRequestError(0n, 10)?.code).toBe('invalid-request')
  })

  it('proves the truncation it is guarding against is real', () => {
    // Same demonstration as the mint's, on the rent composer: no throw, no error,
    // just a different amount in a well-formed instruction. This is what would
    // have been signed without the check above.
    const oversized = U64_MAX * 2n
    const [paid] = rentTransfers(market, key(), key(), oversized, 1).map((ix) => readTransfer(ix))
    expect(paid.amount).not.toBe(oversized)
    expect(paid.amount).toBeLessThanOrEqual(U64_MAX)
  })

  it('is reached by the builder, which refuses it too', async () => {
    // The builder gates on configuration first, so offline this can only prove
    // the path exists and resolves. The amount check itself is the block above.
    const result = await buildRentTransaction(key().toBase58(), key().toBase58(), U64_MAX, 2, {
      endpoint: 'not-an-rpc-url',
    })
    expect(isSplError(result)).toBe(true)
  })
})

/* ---- Rent arithmetic is fees.ts, not a second copy of it ----------------- */

describe('rent fee arithmetic', () => {
  it('matches rentQuote in fees.ts for whole-token listings', () => {
    const cases: [number, number, number][] = [
      [1, 1, 9],
      [0.07, 12, 9],
      [3.5, 4, 6],
      [1_234.5678, 7, 9],
      [0.000001, 30, 6],
      [999.999999999, 2, 9],
    ]
    for (const [perEpoch, term, decimals] of cases) {
      const expected = rentQuote(perEpoch, term, decimals)
      const actual = quoteRent(toRawUnits(perEpoch, decimals), term)
      expect(actual).toEqual(expected)
    }
  })

  it('charges 10% and not the 5% mints and sales pay', () => {
    const perEpoch = toRawUnits(100, 9)
    const quote = quoteRent(perEpoch, 3)
    expect(quote.bps).toBe(SIM_RENT_FEE_BPS)
    expect(quote.bps).not.toBe(SIM_SALE_FEE_BPS)
    expect(quote.gross).toBe(toRawUnits(300, 9))
    expect(quote.fee).toBe(toRawUnits(30, 9))
    expect(quote.total).toBe(toRawUnits(330, 9))
  })

  // The fee is taken once on the contract total, not per epoch. Flooring `term`
  // times instead of once loses up to one raw unit per epoch, and at dust
  // amounts it loses the entire fee.
  it('floors once on the whole contract, not once per epoch', () => {
    const perEpoch = 5n
    const term = 3
    expect(quoteRent(perEpoch, term).fee).toBe(feeOn(perEpoch * BigInt(term), SIM_RENT_FEE_BPS))
    expect(quoteRent(perEpoch, term).fee).toBe(1n)
    expect(feeOn(perEpoch, SIM_RENT_FEE_BPS) * BigInt(term)).toBe(0n)
  })

  it('splits a rental into the owner’s take and the treasury’s cut', () => {
    const renter = key()
    const owner = key()
    const perEpoch = toRawUnits(12.5, 9)
    const transfers = rentTransfers(market, renter, owner, perEpoch, 8)
    expect(transfers).toHaveLength(2)

    const [paid, fee] = transfers.map((ix) => readTransfer(ix))
    const quote = quoteRent(perEpoch, 8)

    expect(paid.destination).toBe(ata(owner).toBase58())
    expect(paid.amount).toBe(quote.gross)
    expect(fee.destination).toBe(ata(TREASURY).toBase58())
    expect(fee.amount).toBe(quote.fee)

    // Both legs debit the renter, under one signature. There is no ordering in
    // which the owner is paid and the treasury is not.
    for (const t of [paid, fee]) {
      expect(t.source).toBe(ata(renter).toBase58())
      expect(t.authority).toBe(renter.toBase58())
    }
  })
})

/* ---- The claim ----------------------------------------------------------- */

describe('claim', () => {
  it('moves the treasury balance to the dev wallet on the treasury’s own signature', () => {
    const claim = readTransfer(claimTransfer(market, 42n))
    expect(claim.source).toBe(ata(TREASURY).toBase58())
    expect(claim.destination).toBe(ata(DEV_WALLET).toBase58())
    // The authority is the treasury wallet: the operator's keypair, not a PDA and
    // not a program. Nothing on-chain adjudicates whether the claim *should*
    // happen — the token program only checks who signed.
    expect(claim.authority).toBe(TREASURY.toBase58())
    expect(claim.amount).toBe(42n)
  })
})

/* ---- Safe by default: the unconfigured gate ------------------------------ */

describe('unconfigured gate', () => {
  it('ships with every deployment constant empty', () => {
    expect(xnftMintAddress()).toBe('')
    expect(treasuryAddress()).toBe('')
    expect(devWalletAddress()).toBe('')
    expect(isMintConfigured()).toBe(false)
    expect(isConfigured()).toBe(false)
    expect(isBurnConfigured()).toBe(false)
  })

  // The gate split the fee removal forced. Minting pays no configured wallet, so
  // it asks about the mint alone; rent and claim still pay the treasury, so they
  // ask about all three. Both are false in the shipped state, which is the only
  // state that matters for safety — this asserts the *relationship*, so a future
  // edit cannot widen the mint gate into "no configuration required at all".
  it('gates minting on the mint alone and everything else on the full set', () => {
    expect(isBurnConfigured()).toBe(isMintConfigured())
    // The full gate is strictly stronger: whenever it holds, the mint gate does.
    expect(isConfigured() && !isMintConfigured()).toBe(false)
  })

  // Every entry point, in one sweep, so a new one added without a gate shows up
  // as a missing line here rather than as a live transaction against a token that
  // does not exist. The endpoint passed is deliberately unusable: a `network`
  // error would prove the gate ran *after* the connection was opened.
  const BAD_RPC = { endpoint: 'not-an-rpc-url' }
  const owner = key().toBase58()
  const other = key().toBase58()

  const paths: [string, () => Promise<unknown>][] = [
    ['fetchOwnerBalance', () => fetchOwnerBalance(owner, BAD_RPC.endpoint)],
    ['fetchTreasuryBalance', () => fetchTreasuryBalance(BAD_RPC.endpoint)],
    ['buildMintTransaction', () => buildMintTransaction(owner, BAD_RPC)],
    ['buildRentTransaction', () => buildRentTransaction(owner, other, 1n, 1, BAD_RPC)],
    ['buildClaimTransaction', () => buildClaimTransaction(owner, 1n, BAD_RPC)],
    ['sendMint', () => sendMint(owner, NEVER_SIGNS, BAD_RPC)],
    ['sendRent', () => sendRent(owner, other, 1n, 1, NEVER_SIGNS, BAD_RPC)],
    ['sendClaim', () => sendClaim(owner, 1n, NEVER_SIGNS, BAD_RPC)],
  ]

  for (const [name, run] of paths) {
    it(`${name} refuses without touching the network`, async () => {
      const result = await run()
      expect(isSplError(result)).toBe(true)
      expect((result as { code: string }).code).toBe('not-configured')
    })
  }

  it('refuses the adapter surface in solana.ts too', async () => {
    for (const result of [
      await fetchXnftBalance(owner, BAD_RPC.endpoint),
      await buildBurnTransaction(owner, BAD_RPC),
      await sendBurn(owner, NEVER_SIGNS, BAD_RPC),
    ]) {
      expect(isBurnError(result)).toBe(true)
      expect((result as { code: string }).code).toBe('not-configured')
    }
  })

  it('resolves rather than throwing, on every one of them', async () => {
    // The contract is that a money path returns a typed error object. A rejected
    // promise from any of these would surface as an unhandled rejection in a
    // click handler and leave the UI stuck mid-stage.
    await expect(Promise.all(paths.map(([, run]) => run()))).resolves.toBeDefined()
  })
})

/* ---- Error shapes -------------------------------------------------------- */

describe('errors', () => {
  it('recognises its own shape and nothing else', () => {
    expect(isSplError({ code: 'network', message: 'x' })).toBe(true)
    expect(isSplError({ code: 'paused', message: 'x' })).toBe(false)
    expect(isSplError({ code: 'not-authority', message: 'x' })).toBe(false)
    expect(isSplError({ code: 'network' })).toBe(false)
    expect(isSplError(null)).toBe(false)
    expect(isSplError('network')).toBe(false)
  })

  it('reads a wallet dismissal as rejection rather than failure', () => {
    expect(classifySendError({ code: 4001 }, 'Mint').code).toBe('rejected')
    expect(classifySendError(new Error('User rejected the request'), 'Mint').code).toBe('rejected')
    expect(classifySendError(new Error('Transaction cancelled'), 'Claim').code).toBe('rejected')
  })

  it('does not call an unexplained failure a rejection', () => {
    expect(classifySendError(new Error('blockhash not found'), 'Mint').code).toBe('network')
    expect(classifySendError({}, 'Mint').code).toBe('unknown')
  })
})

/* ---- Confirmation: the one silence that is a definite negative ----------- */

// A poll that ends without a confirmation can mean two opposite things, and the
// cost of confusing them is asymmetric in both directions. Calling a landed
// transaction failed invites a duplicate of an irreversible burn. Calling a dead
// one successful tells someone their money moved when it did not. The only
// evidence that separates them is the blockhash deadline withBlockhash stamps on
// the transaction: past it, a signature the cluster has never seen can never
// land.

type Status = { err: unknown; confirmationStatus?: string } | null
type Reply = Status | 'throw'

const CONFIRMED: Reply = { err: null, confirmationStatus: 'confirmed' }
const PROCESSED: Reply = { err: null, confirmationStatus: 'processed' }
const ON_CHAIN_FAILURE: Reply = { err: { InstructionError: [0, { Custom: 1 }] } }

const FAILED_MSG = 'the chain rejected it'
const EXPIRED_MSG = 'it never landed'

/** Every timer the poll could ever schedule, plus one, so a pending run always finishes. */
const HORIZON = (CONFIRM_ATTEMPTS + 1) * CONFIRM_DELAY_MS

/**
 * A Connection reduced to the two reads confirmSignature makes, scripted per
 * call so a test can describe a cluster mid-lag rather than a static one.
 */
function stubRpc(script: {
  status: (call: number, searchedHistory: boolean) => Reply
  height?: (call: number) => number | 'throw'
}) {
  const calls = { status: 0, history: 0, height: 0 }
  const connection = {
    async getSignatureStatus(_signature: string, config?: { searchTransactionHistory?: boolean }) {
      const searchedHistory = config?.searchTransactionHistory === true
      if (searchedHistory) calls.history += 1
      const reply = script.status(calls.status++, searchedHistory)
      if (reply === 'throw') throw new Error('rpc unavailable')
      return { context: { slot: 0 }, value: reply }
    },
    async getBlockHeight() {
      const reply = script.height ? script.height(calls.height++) : 'throw'
      if (reply === 'throw') throw new Error('rpc unavailable')
      return reply
    },
  }
  return { connection: connection as unknown as Connection, calls }
}

const DEADLINE = 1_000

describe('confirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  /** Runs a poll that will sleep, to the far end of its bounded schedule. */
  async function toHorizon<T>(pending: Promise<T>): Promise<T> {
    await vi.advanceTimersByTimeAsync(HORIZON)
    return pending
  }

  it('returns success on a confirmed signature without asking about expiry', async () => {
    const { connection, calls } = stubRpc({ status: () => CONFIRMED })
    expect(await confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE)).toBeNull()
    // A confirmed transaction cannot expire, so the deadline read is never spent.
    expect(calls.height).toBe(0)
  })

  it('reports a transaction the chain itself rejected', async () => {
    const { connection } = stubRpc({ status: () => ON_CHAIN_FAILURE })
    const result = await confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE)
    expect(isSplError(result)).toBe(true)
    expect((result as { message: string }).message).toBe(FAILED_MSG)
  })

  // The defect this section exists for. Deadline passed, signature unknown to the
  // cluster even under the widened search: the transaction can never land, and
  // reporting it as success-with-unknown-status told someone their money moved.
  it('reports an expired blockhash with no signature as a definite negative', async () => {
    const { connection, calls } = stubRpc({
      status: () => null,
      height: () => DEADLINE + 1,
    })
    const result = await confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE)
    expect(isSplError(result)).toBe(true)
    expect((result as { code: string }).code).toBe('network')
    expect((result as { message: string }).message).toBe(EXPIRED_MSG)
    // It did not sit out the full schedule first — a definite negative is
    // reportable the moment it is provable.
    expect(calls.height).toBe(1)
  })

  it('proves absence with the widened history search before calling it dead', async () => {
    const { connection, calls } = stubRpc({
      status: () => null,
      height: () => DEADLINE + 1,
    })
    await confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE)
    // The read that decides whether someone is told their money did not move gets
    // the expensive lookup, not the cheap recent-status cache.
    expect(calls.history).toBe(1)
  })

  it('does not call it expired while the blockhash is still valid', async () => {
    const { connection, calls } = stubRpc({
      status: () => null,
      // Exactly at the deadline is still inside it: that block can still take it.
      height: () => DEADLINE,
    })
    const result = await toHorizon(
      confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE),
    )
    expect(result).toBeNull()
    expect(calls.height).toBe(CONFIRM_ATTEMPTS)
    expect(calls.history).toBe(0)
  })

  // A transaction the cluster has already processed cannot expire out from under
  // itself. Treating a lagging confirmation as absence would be the false
  // negative that invites a duplicate burn.
  it('never calls a known-but-unconfirmed signature expired, however late the height', async () => {
    const { connection, calls } = stubRpc({
      status: (call) => (call < 2 ? PROCESSED : CONFIRMED),
      height: () => DEADLINE + 100_000,
    })
    const result = await toHorizon(
      confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE),
    )
    expect(result).toBeNull()
    expect(calls.height).toBe(0)
  })

  // Both halves of the proof are required. Height alone is not evidence: the
  // transaction may have landed in the last block that would take it, with the
  // recent-status cache simply lagging behind the history the wider search reads.
  it('does not call it expired when the wider search finds it after all', async () => {
    const { connection, calls } = stubRpc({
      status: (_call, searchedHistory) => (searchedHistory ? CONFIRMED : null),
      height: () => DEADLINE + 1,
    })
    const result = await toHorizon(
      confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE),
    )
    expect(result).toBeNull()
    expect(calls.history).toBeGreaterThan(0)
  })

  it('does not read an unreachable height as an expiry', async () => {
    const { connection, calls } = stubRpc({
      status: () => null,
      height: () => 'throw',
    })
    const result = await toHorizon(
      confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE),
    )
    // A dead endpoint is not evidence of a dead transaction.
    expect(result).toBeNull()
    expect(calls.history).toBe(0)
  })

  it('does not read a failed status call as absence', async () => {
    const { connection, calls } = stubRpc({
      status: () => 'throw',
      height: () => DEADLINE + 100_000,
    })
    const result = await toHorizon(
      confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE),
    )
    // "The RPC did not answer" is not "the cluster has never heard of it", so the
    // expiry proof is never even attempted.
    expect(result).toBeNull()
    expect(calls.height).toBe(0)
  })

  // The unchanged half of the rule. Without a deadline there is nothing to prove
  // expiry against, and an unknown status stays success-with-unknown-status.
  it('degrades to timeout-only when no deadline was stamped', async () => {
    const { connection, calls } = stubRpc({
      status: () => null,
      height: () => DEADLINE + 100_000,
    })
    const result = await toHorizon(confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG))
    expect(result).toBeNull()
    expect(calls.height).toBe(0)
    expect(calls.status).toBe(CONFIRM_ATTEMPTS)
  })

  it('gives up after a bounded number of attempts rather than polling forever', async () => {
    const { connection, calls } = stubRpc({ status: () => PROCESSED })
    const result = await toHorizon(
      confirmSignature(connection, 'sig', FAILED_MSG, EXPIRED_MSG, DEADLINE),
    )
    expect(result).toBeNull()
    expect(calls.status).toBe(CONFIRM_ATTEMPTS)
  })
})

describe('the RPC endpoint', () => {
  afterEach(() => {
    __resetRuntimeConfigForTests()
  })

  it('falls back to the public endpoint when nothing is configured', () => {
    // Which is what shipped for a while: `VITE_SOLANA_RPC_URL` was documented in
    // .env.example and DEPLOY.md, nothing read it, and no caller ever passed the
    // `endpoint` argument — so every read in the browser went to the public
    // mainnet-beta endpoint no matter what an operator set.
    expect(resolveRpcEndpoint()).toBe(DEFAULT_RPC)
  })

  it('uses the operator’s endpoint from protocol_config', () => {
    __setRuntimeConfigForTests({ rpcUrl: 'https://mainnet.helius-rpc.com/?api-key=abc' })
    expect(resolveRpcEndpoint()).toBe('https://mainnet.helius-rpc.com/?api-key=abc')
  })

  it('reads the config at call time, so a swap reaches live browsers', () => {
    // The whole point of it living in Supabase rather than in the bundle: an
    // operator changing providers mid-incident must not need a redeploy.
    __setRuntimeConfigForTests({ rpcUrl: 'https://one.example/rpc' })
    expect(resolveRpcEndpoint()).toBe('https://one.example/rpc')
    __setRuntimeConfigForTests({ rpcUrl: 'https://two.example/rpc' })
    expect(resolveRpcEndpoint()).toBe('https://two.example/rpc')
  })

  it('lets an explicit argument win over the configured value', () => {
    __setRuntimeConfigForTests({ rpcUrl: 'https://configured.example/rpc' })
    expect(resolveRpcEndpoint('https://explicit.example/rpc')).toBe('https://explicit.example/rpc')
  })

  it('degrades to the public endpoint on a malformed value rather than refusing', () => {
    // Deliberately the OPPOSITE of how the mint and the payee are treated. Those
    // decide where money goes and a bad one must stop everything; this decides
    // only how reliably the chain is read, so one stray character in a text
    // field must not take every balance read on the site off the air.
    for (const bad of ['not a url', 'ws://mainnet.example', 'ftp://x.example', 'javascript:alert(1)', '   ']) {
      expect(`${bad} -> ${resolveRpcEndpoint(bad)}`).toBe(`${bad} -> ${DEFAULT_RPC}`)
    }
    __setRuntimeConfigForTests({ rpcUrl: 'not a url' })
    expect(resolveRpcEndpoint()).toBe(DEFAULT_RPC)
  })

  it('accepts a plain-http endpoint, for a local validator', () => {
    expect(resolveRpcEndpoint('http://127.0.0.1:8899')).toBe('http://127.0.0.1:8899')
  })

  it('opens one client per endpoint and reuses it', () => {
    __setRuntimeConfigForTests({ rpcUrl: 'https://reuse.example/rpc' })
    expect(getConnection()).toBe(getConnection())
    expect(getConnection('https://other.example/rpc')).not.toBe(getConnection())
  })

  it('points the client at the configured endpoint', () => {
    __setRuntimeConfigForTests({ rpcUrl: 'https://pointed.example/rpc' })
    expect(getConnection().rpcEndpoint).toBe('https://pointed.example/rpc')
  })
})
