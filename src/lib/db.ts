// THE SEAM.
//
// ===========================================================================
// ONE GATE, NOT A HUNDRED NULL CHECKS
// ===========================================================================
// This app has to run perfectly with no backend at all. The env vars are unset
// until an operator sets them, and until then every surface — holdings, the xNET
// directory, profiles, the inbox, the payout queue — has to fall back to the
// deterministic in-browser generation and the localStorage stores it shipped with.
//
// `isBackendEnabled()` is that gate, and it is the ONLY one. Every module that
// used to own a localStorage key now asks this single question at the top of each
// entry point and takes one of two whole paths:
//
//   false — the code that was already there, untouched. Deterministic wallets,
//           seeded inboxes, local profiles, local payment tickets. No request is
//           made, no promise is created, nothing can reject.
//   true  — the same shapes, filled from Postgres through the caches below.
//
// Scattering `if (row?.x ?? fallback)` through eight files would produce a third
// hybrid behaviour that nobody designed and nobody can test, and the first missing
// column would take a page down. Two paths, one switch.
//
// ===========================================================================
// WHY THERE IS A CACHE AT ALL
// ===========================================================================
// Every consumer of this data is synchronous. `loadInbox(address, now)` is called
// inside a `useMemo`, `networkWallets(now)` inside a render, `loadProfile` inside
// a form's initial state — none of them can await, and changing them to async
// would rewrite pages this module does not own.
//
// So a read is split in two: a synchronous `peek` that answers from memory right
// now, and an asynchronous refresh that fills memory in the background. The first
// paint after a cold start shows the local fallback; the backend snapshot replaces
// it on the next clock tick, which every one of these surfaces already has
// (`useNow`). That is a deliberate trade — a page that renders immediately with
// slightly stale data beats a spinner that can hang forever, which the brief rules
// out explicitly.
//
// ===========================================================================
// NOTHING HERE THROWS AND NOTHING HERE BLOCKS
// ===========================================================================
// A load that fails leaves the previous snapshot in place and records the error.
// A caller never sees a rejected promise, an exception, or a `null` where it
// expected an array — `peek` returns null only for "not loaded yet", which every
// consumer already handles by using its local fallback.
import {
  fetchFriendRequests,
  fetchFriends,
  fetchMessages,
  fetchOwnedXployees,
  fetchPayoutRequests,
  fetchProfile,
  fetchThreads,
  fetchTradeOfferLegs,
  fetchTradeOffers,
  fetchWallets,
  isSupabaseConfigured,
  isSupabaseError,
  sessionToken,
  type FriendEdgeRow,
  type FriendRequestRow,
  type MessageRow,
  type PayoutRequestRow,
  type ProfileRow,
  type SupabaseError,
  type ThreadRow,
  type TradeOfferLegRow,
  type TradeOfferRow,
  type XployeeRow,
} from './supabase'
import { byId } from './collection'
import { buildXployee, type Xployee } from './xployee'

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

/**
 * THE ONE SWITCH. True when a Supabase project is configured.
 *
 * Read it at the top of an entry point, not in the middle of one: a function that
 * checks it twice can take half of each path.
 */
export function isBackendEnabled(): boolean {
  return isSupabaseConfigured()
}

/**
 * True when the visitor has an X session.
 *
 * A second, narrower question, and it is NOT the gate. The correspondence tables —
 * friend requests, threads, messages, trade offers — are granted to `authenticated`
 * only and their policies filter on the session's own wallet, so they are readable
 * with a session and invisible without one. Everything else (ownership, the wallet
 * directory, profiles, friendships, settled claims) is published to anon and loads
 * for a signed-out visitor.
 */
export function isSignedInToBackend(): boolean {
  return isBackendEnabled() && sessionToken() !== null
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

const listeners = new Set<() => void>()

/**
 * Fires whenever any snapshot changes.
 *
 * Exported so a surface that wants to repaint the moment data arrives can, rather
 * than waiting for its clock. Nothing is required to subscribe — the fallback of
 * "repaint on the next tick" is what makes this optional.
 */
export function subscribeBackend(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notify(): void {
  for (const listener of listeners) listener()
}

interface Cell<T> {
  /** What is in memory right now. Null means "never loaded", never "empty". */
  peek: () => T | null
  /** The last failure, kept so a surface can say why it is showing stale data. */
  error: () => SupabaseError | null
  /** Kicks off a load if the snapshot is missing or stale. Returns immediately. */
  ensure: () => void
  /** Forces a reload and resolves when it is done. Used after a write. */
  refresh: () => Promise<void>
  /** Drops the snapshot without loading. The next `ensure` starts cold. */
  forget: () => void
}

/**
 * Default staleness. Short enough that a second browser's message shows up while
 * you are looking at the page, long enough that a per-second clock tick does not
 * become a per-second request — `ensure` is called from render paths, so this
 * number is the request rate.
 */
const DEFAULT_TTL_MS = 20_000

function makeCell<T>(load: () => Promise<T | SupabaseError>, ttlMs = DEFAULT_TTL_MS): Cell<T> {
  let value: T | null = null
  let failure: SupabaseError | null = null
  let loadedAt = 0
  let inFlight: Promise<void> | null = null

  const run = async (): Promise<void> => {
    // One request at a time per cell. Without this, a component that renders three
    // times before the first response lands issues three identical reads.
    if (inFlight) return await inFlight
    inFlight = (async () => {
      try {
        const result = await load()
        if (isSupabaseError(result)) {
          failure = result
          // The previous snapshot is KEPT. A transient network failure must not
          // blank a page that was rendering fine a second ago.
        } else {
          value = result
          failure = null
        }
      } catch (e) {
        // A loader is not supposed to throw — every read in ./supabase resolves —
        // but a bug in a composer here would otherwise reject an unawaited
        // promise and surface as an unhandled rejection in the console.
        failure = {
          code: 'malformed',
          message: e instanceof Error ? e.message : 'The index returned something unreadable.',
        }
      } finally {
        // Stamped even on failure, so a project that is unreachable is retried on
        // a timer rather than on every single render.
        loadedAt = Date.now()
        inFlight = null
      }
      notify()
    })()
    await inFlight
  }

  return {
    peek: () => value,
    error: () => failure,
    ensure: () => {
      if (!isBackendEnabled()) return
      if (inFlight) return
      if (value !== null && Date.now() - loadedAt < ttlMs) return
      if (value === null && loadedAt > 0 && Date.now() - loadedAt < ttlMs) return
      void run()
    },
    refresh: async () => {
      if (!isBackendEnabled()) return
      loadedAt = 0
      await run()
    },
    forget: () => {
      value = null
      failure = null
      loadedAt = 0
    },
  }
}

/**
 * Cells keyed by wallet.
 *
 * Created on first use rather than up front, because the set of wallets a session
 * looks at is not known in advance — and dropped wholesale on sign-out, so one
 * visitor's inbox cannot survive into another's session in the same tab.
 */
function keyedCells<T>(load: (key: string) => Promise<T | SupabaseError>, ttlMs?: number) {
  const cells = new Map<string, Cell<T>>()
  return {
    for(key: string): Cell<T> {
      const existing = cells.get(key)
      if (existing) return existing
      const created = makeCell(() => load(key), ttlMs)
      cells.set(key, created)
      return created
    },
    clear() {
      cells.clear()
    },
  }
}

// ---------------------------------------------------------------------------
// Ownership — who holds which serial
// ---------------------------------------------------------------------------

export interface OwnershipSnapshot {
  /** Owner address to the serials it holds, ascending. */
  byOwner: ReadonlyMap<string, number[]>
  ownerOf: ReadonlyMap<number, string>
  /**
   * Hire time per serial, epoch ms. This is what lets a minted serial outside the
   * 512-strong genesis collection be rebuilt: `buildXployee` needs an id and a
   * hire time, and the id alone determines everything else.
   */
  hiredAt: ReadonlyMap<number, number>
  /** Non-zero means the ownership graph is incomplete and a total over it is not exact. */
  skipped: number
}

function composeOwnership(rows: readonly XployeeRow[], skipped: number): OwnershipSnapshot {
  const byOwner = new Map<string, number[]>()
  const ownerOf = new Map<number, string>()
  const hiredAt = new Map<number, number>()

  for (const row of rows) {
    if (row.hiredAt !== null) hiredAt.set(row.id, row.hiredAt)
    if (!row.owner) continue
    ownerOf.set(row.id, row.owner)
    const held = byOwner.get(row.owner)
    if (held) held.push(row.id)
    else byOwner.set(row.owner, [row.id])
  }
  for (const held of byOwner.values()) held.sort((a, b) => a - b)

  return { byOwner, ownerOf, hiredAt, skipped }
}

const ownershipCell = makeCell<OwnershipSnapshot>(async () => {
  const result = await fetchOwnedXployees()
  return isSupabaseError(result) ? result : composeOwnership(result.rows, result.skipped)
}, 30_000)

/** The ownership graph, or null until it has loaded. Kicks off a load as a side effect. */
export function ownership(): OwnershipSnapshot | null {
  ownershipCell.ensure()
  return ownershipCell.peek()
}

export function refreshOwnership(): Promise<void> {
  return ownershipCell.refresh()
}

// ---------------------------------------------------------------------------
// The wallet directory
// ---------------------------------------------------------------------------

export interface DirectoryEntry {
  address: string
  handle: string | null
  bio: string | null
  /** VERIFIED. `wallets.twitter` mirrors a handle X confirmed; a trigger refuses any other value. */
  twitter: string | null
}

const directoryCell = makeCell<Map<string, DirectoryEntry>>(async () => {
  const result = await fetchWallets()
  if (isSupabaseError(result)) return result
  const out = new Map<string, DirectoryEntry>()
  for (const row of result.rows) {
    out.set(row.address, {
      address: row.address,
      handle: row.handle,
      bio: row.bio,
      twitter: row.twitter,
    })
  }
  return out
}, 60_000)

export function walletDirectory(): ReadonlyMap<string, DirectoryEntry> | null {
  directoryCell.ensure()
  return directoryCell.peek()
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

const profileCells = keyedCells<ProfileRow | null>(async (wallet) => {
  const result = await fetchProfile(wallet)
  // A wallet with no profile row is a legitimate answer, not a failure — most
  // wallets have never saved one. Null is cached so it is not re-fetched on every
  // render of a page belonging to somebody who never signed up.
  return isSupabaseError(result) ? result : result
}, 30_000)

/**
 * `undefined` means "not loaded"; `null` means "loaded, and this wallet has no
 * profile". Callers need both: the first says use the local fallback, the second
 * says the fallback IS the answer.
 */
export function remoteProfile(wallet: string): ProfileRow | null | undefined {
  if (!wallet) return null
  const cell = profileCells.for(wallet)
  cell.ensure()
  const value = cell.peek()
  return value === null ? undefined : value
}

export function refreshProfile(wallet: string): Promise<void> {
  return profileCells.for(wallet).refresh()
}

// ---------------------------------------------------------------------------
// The inbox
// ---------------------------------------------------------------------------

/**
 * The social layer as rows, deliberately unprojected.
 *
 * The Thread/Inbox shapes the UI renders belong to ./social, which owns the
 * projection and the ordering. This module's job is to fetch and to say what
 * arrived — putting the projection here would mean two files that both know what
 * an unread count is.
 */
export interface InboxSnapshot {
  friends: FriendEdgeRow[]
  requests: FriendRequestRow[]
  threads: ThreadRow[]
  messages: MessageRow[]
  offers: TradeOfferRow[]
  legs: TradeOfferLegRow[]
  /**
   * True when the correspondence half was skipped because there is no session.
   * A caller showing an empty inbox needs to know whether it is empty or invisible.
   */
  correspondenceUnavailable: boolean
}

const EMPTY_INBOX: InboxSnapshot = {
  friends: [],
  requests: [],
  threads: [],
  messages: [],
  offers: [],
  legs: [],
  correspondenceUnavailable: true,
}

/**
 * Composed from six reads, and a failure in one does NOT fail the rest.
 *
 * The friendship graph is public and the correspondence is not, so a signed-out
 * visitor legitimately gets friends and nothing else. Failing the whole snapshot
 * on the first 401 would blank a friends list that loaded perfectly well.
 */
const inboxCells = keyedCells<InboxSnapshot>(async (wallet) => {
  const snapshot: InboxSnapshot = {
    friends: [],
    requests: [],
    threads: [],
    messages: [],
    offers: [],
    legs: [],
    correspondenceUnavailable: !isSignedInToBackend(),
  }

  const friends = await fetchFriends(wallet)
  if (!isSupabaseError(friends)) snapshot.friends = friends.rows

  if (snapshot.correspondenceUnavailable) return snapshot

  // Requests, threads and offers are independent; messages and legs hang off two
  // of them, so those are fetched second with whatever ids arrived.
  const [requests, threads, offers] = await Promise.all([
    fetchFriendRequests(),
    fetchThreads(),
    fetchTradeOffers(),
  ])
  if (!isSupabaseError(requests)) snapshot.requests = requests.rows
  if (!isSupabaseError(threads)) snapshot.threads = threads.rows
  if (!isSupabaseError(offers)) snapshot.offers = offers.rows

  const [messages, legs] = await Promise.all([
    fetchMessages(snapshot.threads.map((t) => t.id)),
    fetchTradeOfferLegs(snapshot.offers.map((o) => o.id)),
  ])
  if (!isSupabaseError(messages)) snapshot.messages = messages.rows
  if (!isSupabaseError(legs)) snapshot.legs = legs.rows

  return snapshot
}, 12_000)

export function remoteInbox(wallet: string): InboxSnapshot | null {
  if (!wallet) return EMPTY_INBOX
  const cell = inboxCells.for(wallet)
  cell.ensure()
  return cell.peek()
}

export function refreshInbox(wallet: string): Promise<void> {
  return wallet ? inboxCells.for(wallet).refresh() : Promise.resolve()
}

// ---------------------------------------------------------------------------
// The payout queue
// ---------------------------------------------------------------------------

const paymentCells = keyedCells<PayoutRequestRow[]>(async (wallet) => {
  const result = await fetchPayoutRequests(wallet)
  return isSupabaseError(result) ? result : result.rows
}, 15_000)

export function remotePayoutRequests(wallet: string): PayoutRequestRow[] | null {
  if (!wallet) return []
  const cell = paymentCells.for(wallet)
  cell.ensure()
  return cell.peek()
}

export function refreshPayoutRequests(wallet: string): Promise<void> {
  return wallet ? paymentCells.for(wallet).refresh() : Promise.resolve()
}

// ---------------------------------------------------------------------------
// Rebuilding an xployee the collection has never seen
// ---------------------------------------------------------------------------

/**
 * The xployee for a serial, wherever it came from.
 *
 * `byId` covers the 512 genesis workers and nothing else, because `collection()`
 * is the first 512 draws of the reveal order. A minted serial is a real xployee
 * that is simply not in that slice, and `byId` returns undefined for it — which is
 * how a freshly minted worker renders as a blank card.
 *
 * Everything about an xployee except its hire time is a pure function of its
 * serial, so a hire time from the database is the only extra input needed to
 * rebuild one identically. Rebuilds are memoised because this is called from
 * render paths, once per card per frame.
 */
const rebuilt = new Map<number, Xployee>()

export function xployeeFor(id: number, hiredAt?: number | null): Xployee | undefined {
  if (!Number.isInteger(id) || id < 0) return undefined

  const genesis = byId(id)
  if (genesis) return genesis

  const cached = rebuilt.get(id)
  if (cached) return cached

  // No hire time and not in the genesis slice: the caller knows a serial exists
  // but nothing knows when it was hired, and inventing one would make accrual
  // differ between two renders of the same worker.
  const when = typeof hiredAt === 'number' && Number.isFinite(hiredAt) ? hiredAt : null
  if (when === null) {
    const fromGraph = ownershipCell.peek()?.hiredAt.get(id)
    if (fromGraph === undefined) return undefined
    const built = buildXployee(id, fromGraph)
    rebuilt.set(id, built)
    return built
  }

  const built = buildXployee(id, when)
  rebuilt.set(id, built)
  return built
}

// ---------------------------------------------------------------------------
// Session changes
// ---------------------------------------------------------------------------

/**
 * Drops every per-wallet snapshot.
 *
 * Called when a session ends. An inbox cached under a wallet address is data one
 * session was allowed to see, and leaving it in memory after sign-out would let
 * the next visitor in the same tab read it.
 */
export function forgetSessionData(): void {
  profileCells.clear()
  inboxCells.clear()
  paymentCells.clear()
  notify()
}
