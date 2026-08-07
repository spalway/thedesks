// React state for the Payouts desk: the treasury claim in ./spl and the Supabase
// payout index in ./supabase.
//
// WHAT A CLAIM IS, NOW THAT THERE IS NO PROGRAM. The treasury is an ordinary SPL
// token account owned by a wallet whose keypair the operator holds. A claim is
// one `transferChecked` out of it, signed by that keypair. The token program
// enforces that nobody else can move the balance — that part is real and always
// was. What is gone is anything enforcing *where* it goes: `Config.dev_wallet`
// used to be an on-chain address constraint, and the destination is now a
// constant compiled into this client. So `claim()` is an authorization the
// operator performs, not a permission the chain grants. Every sentence this file
// renders has to be true under that reading.
//
// Four rules shape the file.
//
//   1. The claimable balance is read LIVE FROM THE CHAIN, never from Supabase.
//      Supabase is an index and a payout queue, not a ledger — asking it how much
//      money exists would make a stale row spendable. When the two disagree the
//      chain wins and the index gets rebuilt.
//   2. A signature is never lost. The instant the wallet returns one, the claim
//      becomes a pending row in state *and* in localStorage, before the Edge
//      Function post is even attempted. A dropped signature invites a second
//      claim of money that already moved.
//   3. A second claim cannot be signed while a first is unsettled. See
//      `claimLocked` — this is the rule the rest of the file exists to serve, and
//      the one a confirmation timeout would otherwise defeat.
//   4. Nothing here claims on its own. `claim()` exists to be wired to a click,
//      exactly like `useBurn.burn()`. Mounting, re-rendering or switching wallets
//      can only ever cost an RPC read.
//
// ./spl and ./supabase are owned by other tracks and both resolve typed errors
// rather than throwing. `orThrow` below is the ONLY place in this app where such
// an error becomes a rejection, and it exists solely because TanStack Query needs
// one to populate `error`. Nothing downstream of it throws, and the claim path
// does not go through it at all.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Transaction } from '@solana/web3.js'
import {
  devWalletAddress,
  treasuryAddress,
  fetchTreasuryBalance,
  isConfigured,
  isSplError,
  sendClaim,
} from './spl'
import { SIM_RENT_FEE_BPS, SIM_SALE_FEE_BPS } from './fees'
import {
  fetchPayouts,
  isSupabaseError,
  isSupabaseConfigured,
  recordPayoutSignature,
  type PayoutRow,
  type SupabaseError,
} from './supabase'

export type PayoutStatus = 'pending' | 'confirmed' | 'failed'

/**
 * Every stage the claim passes through. `confirming` is not decorative: the
 * signature exists and the transaction is genuinely unconfirmed while it shows.
 */
export type ClaimStage =
  | 'idle'
  | 'preparing'
  | 'awaiting-signature'
  | 'confirming'
  | 'done'
  | 'error'

export interface ClaimError {
  code: string
  message: string
}

/**
 * The fixed facts of the desk: who signs, where a claim lands, what the protocol
 * charges.
 *
 * All four are module constants rather than a fetched account, because there is
 * no account to fetch. That is worth stating rather than glossing: `treasury` and
 * `devWallet` are not on-chain configuration any more, they are values shipped in
 * this bundle. A build pointed at the wrong one would be wrong quietly, which is
 * why `isConfigured()` refuses to arm anything until all three deployment
 * constants are deliberately set.
 */
export interface TreasuryDesk {
  /** The operator wallet. Its associated $xNFT account IS the treasury. */
  treasury: string
  /** Where a claim sends the fees. A convention this client keeps, not one the chain enforces. */
  devWallet: string
  tradeFeeBps: number
  rentFeeBps: number
}

export interface PayoutEntry {
  /** Stable key: the index row's id, or the signature for a row only this browser holds. */
  id: string
  /**
   * Null only for an index row written without one. Every row this desk creates
   * has a signature, because the signature is what creates it.
   */
  signature: string | null
  /**
   * Raw units. A u64 treasury at 9 decimals runs past Number.MAX_SAFE_INTEGER, so
   * this stays bigint.
   *
   * Null for an indexed row the chain has not answered for yet: `payouts.amount`
   * is NULL until `confirm-payout` reads the settled transfer, and the index
   * deliberately does not substitute the browser's assertion for it. Callers
   * render '—' — there is no figure, and a zero here would read as a settled
   * nothing. A row this browser created always carries one, because the claim is
   * what produced it.
   */
  amount: bigint | null
  /**
   * False while `amount` is still what the claim asked for rather than what the
   * chain says moved. Surfaced so a figure nobody has verified is never rendered
   * as though somebody had.
   */
  amountVerified: boolean
  destination: string
  status: PayoutStatus
  requestedAt: number
  confirmedAt: number | null
  /**
   * True while the row exists only in this browser — the Edge Function has not
   * indexed it yet. Surfaced in the UI so a pending row that is merely local is
   * never mistaken for one the backend is actually watching.
   */
  local: boolean
}

export interface PayoutsState {
  /** False until all three deployment constants in ./spl are set. */
  configured: boolean
  /** False when Supabase has no credentials; history and the queue are then unavailable. */
  indexed: boolean
  desk: TreasuryDesk
  /** True when the connected wallet is the treasury wallet — the only one that can sign a claim. */
  isOperator: boolean
  /** Raw units held by the treasury right now, straight from the chain. Null until read. */
  claimable: bigint | null
  /** The $xNFT mint's decimals. Null until the treasury read lands — amounts render as '—' rather than guessed. */
  decimals: number | null
  /** The treasury's token account, so the page can point at the thing it is describing. */
  treasuryAccount: string | null
  balanceLoading: boolean
  balanceError: string | null
  history: PayoutEntry[]
  historyLoading: boolean
  historyError: string | null
  /** Sum of settled claims the index knows about. Display only; never gates anything. */
  claimedIndexed: bigint
  /**
   * False when the sum above is known to be incomplete — a row carrying a
   * requested rather than a verified amount, a confirmed row with no amount at
   * all, or a row ./supabase could not parse and left out of the page entirely.
   */
  claimedIndexedExact: boolean
  /** True while an unsettled claim exists. While it is true, `claim()` refuses. */
  claimLocked: boolean
  stage: ClaimStage
  error: ClaimError | null
  /** The signature of the claim made in this session, the moment the wallet returns it. */
  signature: string | null
  claim: (signAndSend: (tx: Transaction) => Promise<string>) => Promise<boolean>
  /** Stops this browser holding a claim it can no longer resolve. See `release` below. */
  release: (signature: string) => void
  reset: () => void
  refresh: () => void
}

const TREASURY_KEY = ['xnft', 'treasury'] as const
const PAYOUTS_KEY = ['xnft', 'payouts'] as const

/** Signatures this browser is holding on behalf of the indexer. */
const PENDING_KEY = 'xnfts:payouts:pending'

/**
 * A post to `request-payout` that keeps failing is a backend problem, not
 * something to retry until the tab is closed. The signature stays in storage
 * either way, so a later session picks the sweep back up.
 */
const MAX_RECORD_ATTEMPTS = 5

/** The treasury is the one number that must not be stale — it gates a real transfer. */
const TREASURY_REFETCH_MS = 30_000
const HISTORY_REFETCH_PENDING_MS = 15_000
const HISTORY_REFETCH_IDLE_MS = 60_000
const HISTORY_PAGE = 50

/* ---- The desk ------------------------------------------------------------ */

/**
 * Not a hook and not a query — every field is a compile-time constant. It is
 * built once here rather than read from ./spl at each call site so the page has a
 * single object to render and a rename over there breaks one function.
 */
const DESK: TreasuryDesk = {
  treasury: treasuryAddress(),
  devWallet: devWalletAddress(),
  // Number() on a bps constant is safe in a way it is not on a balance: these are
  // 500 and 1000, they are compared against nothing, and they only ever divide by
  // 100 to print a percentage.
  tradeFeeBps: Number(SIM_SALE_FEE_BPS),
  rentFeeBps: Number(SIM_RENT_FEE_BPS),
}

/* ---- Boundary adapters -------------------------------------------------- */

/**
 * The one place a typed error becomes a thrown one.
 *
 * TanStack Query decides success by whether the promise resolved, so a module
 * that resolves its failures — which ./supabase and ./spl both deliberately do —
 * cannot be used as a `queryFn` directly. Doing exactly that is what put a
 * SupabaseError into `payoutsQuery.data`, where `rows.map` threw inside a render
 * and took the page down instead of showing its error state, while
 * `payoutsQuery.error` stayed null and made the error branch unreachable.
 *
 * So the conversion is explicit, named, and lives here alone. Note the direction:
 * this is only ever applied to a READ. No money path is allowed through it,
 * because a thrown claim is a claim whose outcome nobody recorded.
 */
function orThrow<T>(result: T | SupabaseError): T {
  if (isSupabaseError(result)) throw new Error(result.message)
  return result
}

/** Raw units out of localStorage, which is user-writable and therefore not trusted. */
function parseStoredAmount(value: string): bigint {
  return /^\d+$/.test(value) ? BigInt(value) : 0n
}

function errorText(e: unknown): string | null {
  if (!e) return null
  return e instanceof Error ? e.message : 'Unknown error'
}

/**
 * Raw units to a display string, in integer arithmetic only.
 *
 * Deliberately not routed through format.ts's `xnft()`: that takes a float, and
 * a u64 balance at 9 decimals loses precision as a Number long before it runs
 * out of room as a u64. Splitting the whole and fractional halves as strings
 * keeps the figure exact however large the treasury gets.
 *
 * The fraction is truncated rather than rounded — a balance display must never
 * round up past what is actually claimable.
 */
export function formatRaw(raw: bigint, decimals: number, maxFractionDigits = 4): string {
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const base = 10n ** BigInt(decimals)
  const whole = (abs / base).toLocaleString('en-US')

  let fraction = ''
  if (decimals > 0 && maxFractionDigits > 0) {
    const digits = (abs % base).toString().padStart(decimals, '0').slice(0, maxFractionDigits)
    const trimmed = digits.replace(/0+$/, '')
    if (trimmed) fraction = `.${trimmed}`
  }

  return `${negative ? '-' : ''}${whole}${fraction}`
}

/* ---- The browser's copy of an unconfirmed claim -------------------------- */

interface StoredPending {
  signature: string
  /** Raw units as a decimal string — bigint has no JSON representation. */
  amount: string
  destination: string
  requestedAt: number
}

function readPending(): StoredPending[] {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item): StoredPending[] => {
      if (typeof item !== 'object' || item === null) return []
      const candidate = item as Partial<StoredPending>
      if (typeof candidate.signature !== 'string' || !candidate.signature) return []
      return [
        {
          signature: candidate.signature,
          amount: typeof candidate.amount === 'string' ? candidate.amount : '0',
          destination: typeof candidate.destination === 'string' ? candidate.destination : '',
          requestedAt: typeof candidate.requestedAt === 'number' ? candidate.requestedAt : Date.now(),
        },
      ]
    })
  } catch {
    // Private mode, or a corrupt entry. An unreadable cache is not a failed claim.
    return []
  }
}

function writePending(entries: StoredPending[]): void {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(entries))
  } catch {
    // Non-fatal: the in-memory row still shows this session's claim as pending.
  }
}

/* ---- Chain reads --------------------------------------------------------- */

interface TreasuryRead {
  amount: bigint
  decimals: number
  address: string
}

/**
 * The treasury's live balance. `fetchTreasuryBalance` has already validated the
 * mint's decimals against the same 0..18 bound ./fees enforces, so there is
 * nothing left to re-derive here — the old numeric coercions existed to guard a
 * boundary that now returns bigint and number outright.
 */
async function readTreasury(): Promise<TreasuryRead> {
  const result = await fetchTreasuryBalance()
  if (isSplError(result)) throw new Error(result.message)
  return { amount: result.rawAmount, decimals: result.decimals, address: result.address.toBase58() }
}

/**
 * Whether the connected wallet is the treasury operator.
 *
 * It costs nothing now — with no Config account to read, the question is a string
 * comparison against a module constant — and it still fails closed: an
 * unconfigured build has no treasury address to match, so nobody is the operator.
 *
 * Local to this module on purpose, and it must stay that way. components/Layout.tsx
 * used to import this (as `useIsAuthority`, the program's word for it, back when
 * there was a program) to decide whether the Payouts nav entry exists. But this
 * file statically imports ./spl, so that one import re-attached @solana/web3.js
 * and @solana/spl-token to the main bundle on every route, undoing the code split
 * Mint.tsx pays for. Layout now answers the same question through its own
 * deferred `import('../lib/spl')`. Do not re-export this to save it the trouble.
 *
 * It decides what a nav bar renders and nothing else. The wallet that can actually
 * move the money is whichever one holds the treasury keypair, which no amount of
 * client-side comparison establishes.
 */
function useIsOperator(address: string | null): boolean {
  return isConfigured() && Boolean(address) && address === treasuryAddress()
}

/* ---- The hook ------------------------------------------------------------ */

export function usePayouts(address: string | null): PayoutsState {
  const queryClient = useQueryClient()

  const configured = isConfigured()
  const indexed = isSupabaseConfigured()
  const isOperator = useIsOperator(address)

  const [stage, setStage] = useState<ClaimStage>('idle')
  const [error, setError] = useState<ClaimError | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [pending, setPending] = useState<StoredPending[]>(readPending)

  /** One claim at a time: a double-click must not produce two transfers. */
  const claiming = useRef(false)
  const alive = useRef(true)
  /** Per-signature post count, so a dead Edge Function is retried but not hammered. */
  const recordAttempts = useRef(new Map<string, number>())

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const treasuryQuery = useQuery({
    queryKey: TREASURY_KEY,
    // Only the operator can act on this figure, so only the operator pays for the
    // poll. It is still a chain read, never an index read.
    enabled: configured && isOperator,
    refetchInterval: TREASURY_REFETCH_MS,
    queryFn: readTreasury,
  })

  const payoutsQuery = useQuery({
    queryKey: PAYOUTS_KEY,
    // RLS restricts `payouts` to the treasury operator; firing this for anyone
    // else would be a guaranteed empty round-trip.
    enabled: indexed && isOperator,
    // Poll harder while anything is unconfirmed, then back off — a settled
    // history does not need re-reading every fifteen seconds. Local rows count:
    // they are exactly the ones waiting on `request-payout` to catch up.
    refetchInterval: (query) =>
      pending.length > 0 || (query.state.data?.rows ?? []).some((row) => row.status === 'pending')
        ? HISTORY_REFETCH_PENDING_MS
        : HISTORY_REFETCH_IDLE_MS,
    // Wrapped, never passed directly. `fetchPayouts` resolves its failures and
    // takes an optional `limit`, so handing it over as a queryFn would feed it a
    // QueryFunctionContext and hand its error object back as data.
    queryFn: () => fetchPayouts(HISTORY_PAGE).then(orThrow),
  })

  const rows = useMemo(() => payoutsQuery.data?.rows ?? [], [payoutsQuery.data])

  /**
   * Rows ./supabase parsed and refused. It reports the count rather than dropping
   * them silently precisely so a caller adding money up can decline to call the
   * total exact — see `claimedIndexedExact`.
   */
  const skipped = payoutsQuery.data?.skipped ?? 0

  /** Signatures the index has already seen. The dedupe key between the two sources. */
  const indexedSignatures = useMemo(
    () => new Set(rows.map((row) => row.signature).filter((sig): sig is string => sig !== null)),
    [rows],
  )

  /**
   * Indexed rows plus whatever this browser is still holding.
   *
   * The indexed row always wins: the Edge Function wrote it from its own reading
   * of the transaction, while the local one is a memo written before anyone had
   * verified anything.
   *
   * Every field is read off the parsed `PayoutRow` shape rather than off snake_case
   * keys. The previous version read `row.requested_at` and `row.confirmed_at`,
   * which ./supabase had already parsed into `requestedAt` / `confirmedAt` — so
   * every timestamp in this table was 0 and every claim looked permanently
   * unconfirmed.
   */
  const history = useMemo<PayoutEntry[]>(() => {
    const entries: PayoutEntry[] = rows.map((row: PayoutRow) => ({
      id: row.id,
      signature: row.signature,
      amount: row.amount,
      amountVerified: row.amountVerified,
      destination: row.destination,
      status: row.status,
      requestedAt: row.requestedAt,
      confirmedAt: row.confirmedAt,
      local: false,
    }))

    for (const item of pending) {
      if (indexedSignatures.has(item.signature)) continue
      entries.push({
        id: item.signature,
        signature: item.signature,
        amount: parseStoredAmount(item.amount),
        // A browser's memo of what it asked for. Nothing has verified it.
        amountVerified: false,
        destination: item.destination,
        status: 'pending',
        requestedAt: item.requestedAt,
        confirmedAt: null,
        local: true,
      })
    }

    return entries.sort((a, b) => b.requestedAt - a.requestedAt)
  }, [rows, indexedSignatures, pending])

  /**
   * THE DOUBLE-CLAIM LOCK.
   *
   * While any claim is unsettled, `claimable` above is stale by construction: the
   * transfer may already have moved that balance, and the chain has simply not
   * said so yet. Signing a second claim against it is how the treasury gets paid
   * out twice.
   *
   * The stage machine cannot carry this rule. `stage` returns to 'idle' on
   * `reset()`, on a wallet switch and on remount, and a claim reaching 'done'
   * means only that the send returned — including via the confirmation TIMEOUT,
   * which is success-with-unknown-status and is precisely the case this lock
   * exists for. So the lock is derived from the pending rows instead, which are
   * persisted, survive a reload, and clear only when something that actually
   * knows says so: `confirm-payout` settling the row to confirmed or failed, or —
   * for a row only this browser holds — the operator releasing it by hand after
   * reading the signature on an explorer.
   *
   * Note the failure mode this deliberately accepts. An INDEXED pending row that
   * the backend never settles locks the desk with no escape from this page,
   * because dismissing another party's record of an unsettled transfer is not a
   * thing a browser should be able to do. That direction is the safe one: the
   * desk refuses to move money it is unsure about, and the fix is server-side.
   */
  const claimLocked = useMemo(() => history.some((entry) => entry.status === 'pending'), [history])

  const { claimedIndexed, claimedIndexedExact } = useMemo(() => {
    let total = 0n
    // A row the index could not read is money this sum cannot see, so the page
    // being incomplete is itself enough to make the total inexact.
    let exact = skipped === 0
    for (const entry of history) {
      if (entry.local || entry.status !== 'confirmed') continue
      // The index's `payouts_amount_iff_confirmed` check makes 'confirmed'
      // unreachable while the amount is null, so this pairing is a broken
      // invariant rather than an ordinary state. Leave the row out of the sum and
      // drop the exact flag: a total that quietly counted it as zero would
      // under-report settled money and look precise doing it.
      if (entry.amount === null) {
        exact = false
        continue
      }
      total += entry.amount
      if (!entry.amountVerified) exact = false
    }
    return { claimedIndexed: total, claimedIndexedExact: exact }
  }, [history, skipped])

  /**
   * Signatures this browser holds that the index has not written yet, joined so
   * the sweep below re-runs on a change of contents rather than on every render
   * of an equivalent list.
   */
  const unrecorded = useMemo(
    () => pending.filter((item) => !indexedSignatures.has(item.signature)),
    [pending, indexedSignatures],
  )
  const unrecordedKey = useMemo(
    () => unrecorded.map((item) => item.signature).join(','),
    [unrecorded],
  )

  /**
   * Re-post any signature the index has not picked up.
   *
   * `confirm-payout` can only settle rows that exist, so a post that failed once
   * must not be abandoned — that is exactly how a real payout ends up invisible
   * to everyone but the wallet that signed it. And it must be `recordPayoutSignature`
   * rather than `ingestSignature`: the indexer writes no `payouts` row, so the
   * claim used to be accepted, indexed as nothing, and stranded in one browser's
   * localStorage forever.
   *
   * `unrecorded` is captured from the render whose `unrecordedKey` triggered this
   * effect, so the closure is current whenever it actually runs.
   */
  useEffect(() => {
    if (!indexed || !unrecordedKey) return
    let cancelled = false

    for (const item of unrecorded) {
      const attempts = recordAttempts.current.get(item.signature) ?? 0
      if (attempts >= MAX_RECORD_ATTEMPTS) continue
      recordAttempts.current.set(item.signature, attempts + 1)
      // No .catch: ./supabase resolves its failures rather than rejecting, and a
      // catch here would imply a rejection path that does not exist. A failed
      // post leaves the row in localStorage for the next sweep.
      void recordPayoutSignature(item.signature, parseStoredAmount(item.amount)).then((result) => {
        if (cancelled || isSupabaseError(result)) return
        void queryClient.invalidateQueries({ queryKey: PAYOUTS_KEY })
      })
    }

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexed, unrecordedKey, queryClient])

  // Once a signature is indexed the browser copy has done its job. Dropping it
  // here keeps a row from appearing twice with two different statuses.
  useEffect(() => {
    if (indexedSignatures.size === 0) return
    setPending((prev) => {
      const next = prev.filter((item) => !indexedSignatures.has(item.signature))
      if (next.length === prev.length) return prev
      writePending(next)
      return next
    })
  }, [indexedSignatures])

  const recordPending = useCallback((sig: string, amount: bigint, destination: string) => {
    const entry: StoredPending = {
      signature: sig,
      amount: amount.toString(),
      destination,
      requestedAt: Date.now(),
    }
    setPending((prev) => {
      if (prev.some((item) => item.signature === sig)) return prev
      const next = [...prev, entry]
      writePending(next)
      return next
    })
  }, [])

  /**
   * Drops a browser-held claim, which is the only escape from `claimLocked` when
   * there is no index to settle it — an unconfigured Supabase, or an Edge Function
   * that never comes back.
   *
   * Deliberately manual and deliberately narrow. It touches only rows this
   * browser wrote; an indexed pending row belongs to the backend and is not this
   * page's to dismiss. It changes nothing on-chain — it tells this browser to
   * stop holding a claim whose outcome the operator has gone and checked
   * themselves. Any UI offering it has to say that, because the next thing it
   * permits is another claim.
   */
  const release = useCallback((sig: string) => {
    setPending((prev) => {
      const next = prev.filter((item) => item.signature !== sig)
      if (next.length === prev.length) return prev
      writePending(next)
      return next
    })
  }, [])

  const fail = useCallback((code: string, message: string): false => {
    setError({ code, message })
    setStage('error')
    return false
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setSignature(null)
    setStage('idle')
  }, [])

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TREASURY_KEY })
    void queryClient.invalidateQueries({ queryKey: PAYOUTS_KEY })
  }, [queryClient])

  const claimable = treasuryQuery.data?.amount ?? null
  const decimals = treasuryQuery.data?.decimals ?? null
  const treasuryAccount = treasuryQuery.data?.address ?? null

  const claim = useCallback(
    async (signAndSend: (tx: Transaction) => Promise<string>): Promise<boolean> => {
      if (claiming.current) return false

      // Every refusal below happens before a transaction is built, so a blocked
      // claim costs the operator a sentence rather than a wallet prompt.
      if (!configured) {
        return fail(
          'not-configured',
          'The $xNFT mint, treasury and dev wallet have not been set. No transaction was built.',
        )
      }
      if (!address) return fail('no-wallet', 'Connect the treasury wallet before claiming.')
      if (!isOperator) {
        return fail(
          'not-operator',
          'This wallet does not hold the treasury keypair, so the token program would reject the transfer.',
        )
      }
      if (claimLocked) {
        return fail(
          'claim-pending',
          'A claim from this desk has not settled yet. Until it confirms or fails the treasury figure above may already have been spent, so a second claim is refused.',
        )
      }
      if (claimable === null) return fail('not-ready', 'The treasury balance has not been read yet.')
      if (claimable <= 0n) return fail('nothing-to-claim', 'The treasury is empty — there is nothing to claim.')

      claiming.current = true
      setError(null)
      setSignature(null)
      setStage('preparing')

      // Captured before the await so the amount signed for is the amount recorded,
      // even if a poll lands a new treasury figure mid-flight. The whole balance
      // moves and there is no amount field anywhere in this flow: a claim the
      // operator can type a number into is a claim a bug can type a number into.
      const amount = claimable
      const destination = DESK.devWallet

      try {
        const result = await sendClaim(address, amount, async (tx) => {
          // The stage flips around the wallet call rather than inside sendClaim,
          // so the UI says exactly which half is waiting on whom.
          if (alive.current) setStage('awaiting-signature')
          const sig = await signAndSend(tx)

          // The claim is on the wire. Record it before anything else can fail:
          // from here the signature is the only proof the money moved, the pending
          // row must exist even if this tab closes in the next second, and that
          // same row is what locks the desk against a second claim.
          recordPending(sig, amount, destination)
          if (alive.current) {
            setSignature(sig)
            setStage('confirming')
          }
          return sig
        })

        if (!alive.current) return !isSplError(result)

        if (isSplError(result)) {
          // The pending row deliberately survives this, and so does the lock.
          // `confirm-payout` writes the verdict from its own read of the chain; a
          // browser that saw one error is not the thing that gets to decide money
          // never moved.
          setError({ code: result.code, message: result.message })
          setStage('error')
          return false
        }

        setSignature(result.signature)
        setStage('done')
        return true
      } finally {
        claiming.current = false
        // Stale either way: a rejected claim can still have raced a transfer.
        refresh()
      }
    },
    [address, claimLocked, claimable, configured, fail, isOperator, recordPending, refresh],
  )

  // A wallet switch must not inherit the previous wallet's result. Reads only —
  // this can never trigger a claim, and it cannot clear the lock either, which is
  // the point: the pending rows are not per-wallet state.
  useEffect(() => {
    if (claiming.current) return
    setError(null)
    setSignature(null)
    setStage('idle')
  }, [address])

  return {
    configured,
    indexed,
    desk: DESK,
    isOperator,
    claimable,
    decimals,
    treasuryAccount,
    balanceLoading: configured && isOperator && treasuryQuery.isPending,
    balanceError: errorText(treasuryQuery.error),
    history,
    historyLoading: indexed && isOperator && payoutsQuery.isPending,
    historyError: errorText(payoutsQuery.error),
    claimedIndexed,
    claimedIndexedExact,
    claimLocked,
    stage,
    error,
    signature,
    claim,
    release,
    reset,
    refresh,
  }
}
