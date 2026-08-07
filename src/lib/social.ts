// Friends, direct messages and trade offers — the social layer over the xNet.
//
// There is no server. The visitor's half of every conversation lives in
// localStorage under a single key per wallet address; the other half is
// simulated, because every counterparty is a deterministic wallet from
// network.ts.
//
// Two rules shape the whole file:
//   - reads never throw. Corrupt JSON, a hand-edited entry, blocked storage or
//     an exhausted quota all degrade to an empty inbox on a page that is
//     otherwise fine.
//   - seeding is additive and runs exactly once, so starter content can never
//     land on top of something the visitor actually did.
import { byId } from './collection'
import { networkWallets, walletByAddress, type NetworkWallet } from './network'
import { hashString, pick, pickDistinct, randInt, rngFrom, type Rng } from './rng'
import { serial } from './xployee'

export type ThreadKind = 'message' | 'friend-request' | 'trade-offer'
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export interface Message {
  id: string
  from: string
  to: string
  body: string
  at: number
  read: boolean
}

export interface TradeOffer {
  id: string
  from: string
  to: string
  /** xployee ids the sender is putting up. */
  offering: number[]
  /** xployee ids the sender wants back. May be empty for a gift. */
  requesting: number[]
  /** $xNFT sweetener from the sender. Negative means they want $xNFT back. */
  xnft: number
  status: OfferStatus
  at: number
  note: string
}

export interface FriendRequest {
  id: string
  from: string
  to: string
  at: number
  status: 'pending' | 'accepted' | 'declined'
}

export interface Thread {
  /** Counterparty address. */
  with: string
  handle: string
  lastAt: number
  unread: number
  messages: Message[]
}

export interface Inbox {
  threads: Thread[]
  friends: string[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
  offers: TradeOffer[]
  /** The number the header badge shows. */
  unreadTotal: number
}

/** Everything a compose form needs to fill in; the rest is stamped on send. */
export type TradeOfferDraft = Omit<TradeOffer, 'id' | 'from' | 'status' | 'at'>

/** Long enough for a real pitch, short enough that storage stays bounded. */
export const MESSAGE_MAX = 500

const HOUR_MS = 60 * 60 * 1000

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/**
 * One key per wallet holds the whole social state. A single blob means every
 * mutation is one atomic write — a half-applied "accept" that adds a friend but
 * loses the request it came from is not reachable.
 */
function keyFor(address: string): string {
  return `xnfts:social:${address}`
}

interface SocialState {
  /** Shape version. An entry written by a different one is discarded, not patched. */
  v: number
  /** True once starter content has been written. The guard against re-seeding. */
  seeded: boolean
  messages: Message[]
  /** Both directions, all statuses — the audit trail behind `friends`. */
  requests: FriendRequest[]
  friends: string[]
  offers: TradeOffer[]
}

const STATE_VERSION = 1

function emptyState(): SocialState {
  return { v: STATE_VERSION, seeded: false, messages: [], requests: [], friends: [], offers: [] }
}

export function emptyInbox(): Inbox {
  return {
    threads: [],
    friends: [],
    incomingRequests: [],
    outgoingRequests: [],
    offers: [],
    unreadTotal: 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Non-negative integers, de-duplicated. Anything else in the array is dropped. */
function xployeeIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const out: number[] = []
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0) continue
    if (!out.includes(item)) out.push(item)
  }
  return out
}

const OFFER_STATUSES: readonly OfferStatus[] = ['pending', 'accepted', 'declined', 'withdrawn']
const REQUEST_STATUSES: readonly FriendRequest['status'][] = ['pending', 'accepted', 'declined']

function coerceMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return []
  const out: Message[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const id = str(raw.id)
    const from = str(raw.from)
    const to = str(raw.to)
    const body = str(raw.body).slice(0, MESSAGE_MAX)
    // A message missing any of these can never be rendered or replied to.
    if (!id || !from || !to || !body) continue
    out.push({ id, from, to, body, at: num(raw.at), read: raw.read === true })
  }
  return out
}

function coerceRequests(value: unknown): FriendRequest[] {
  if (!Array.isArray(value)) return []
  const out: FriendRequest[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const id = str(raw.id)
    const from = str(raw.from)
    const to = str(raw.to)
    if (!id || !from || !to) continue
    const status = REQUEST_STATUSES.find((s) => s === raw.status) ?? 'pending'
    out.push({ id, from, to, at: num(raw.at), status })
  }
  return out
}

function coerceOffers(value: unknown): TradeOffer[] {
  if (!Array.isArray(value)) return []
  const out: TradeOffer[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const id = str(raw.id)
    const from = str(raw.from)
    const to = str(raw.to)
    if (!id || !from || !to) continue
    const status = OFFER_STATUSES.find((s) => s === raw.status) ?? 'pending'
    out.push({
      id,
      from,
      to,
      offering: xployeeIds(raw.offering),
      requesting: xployeeIds(raw.requesting),
      // `xpl` is the pre-retirement field name. Offers already sitting in a
      // visitor's localStorage carry it, and the state version was not bumped
      // because nothing else about the shape changed — reading both keeps a
      // pending offer's sweetener instead of silently zeroing it.
      xnft: num(raw.xnft ?? raw.xpl),
      status,
      at: num(raw.at),
      note: str(raw.note).slice(0, MESSAGE_MAX),
    })
  }
  return out
}

function coerceState(value: unknown): SocialState {
  if (!isRecord(value) || value.v !== STATE_VERSION) return emptyState()
  const friends = Array.isArray(value.friends)
    ? value.friends.filter((a): a is string => typeof a === 'string' && a.length > 0)
    : []
  return {
    v: STATE_VERSION,
    seeded: value.seeded === true,
    messages: coerceMessages(value.messages),
    requests: coerceRequests(value.requests),
    friends: [...new Set(friends)],
    offers: coerceOffers(value.offers),
  }
}

/**
 * Session mirror of every write.
 *
 * Some environments hand back a localStorage that reads fine and throws on
 * write — Safari private mode, an exhausted quota — and some have none at all.
 * Losing the message you just sent is a worse failure than not persisting it
 * across reloads, so once storage has proved unusable the tab keeps running off
 * this map instead.
 */
const memory = new Map<string, string>()
let storageOk = true

function readRaw(key: string): string | null {
  if (storageOk) {
    try {
      const raw = localStorage.getItem(key)
      if (raw !== null) return raw
    } catch {
      storageOk = false
    }
  }
  return memory.get(key) ?? null
}

function writeRaw(key: string, value: string): void {
  memory.set(key, value)
  if (!storageOk) return
  try {
    localStorage.setItem(key, value)
  } catch {
    storageOk = false
  }
}

function removeRaw(key: string): void {
  memory.delete(key)
  if (!storageOk) return
  try {
    localStorage.removeItem(key)
  } catch {
    storageOk = false
  }
}

function readState(address: string): SocialState {
  if (!address) return emptyState()
  try {
    const raw = readRaw(keyFor(address))
    if (!raw) return emptyState()
    return coerceState(JSON.parse(raw))
  } catch {
    // Bad JSON or a hand-edited entry — an empty inbox is the answer.
    return emptyState()
  }
}

function writeState(address: string, state: SocialState): void {
  if (!address) return
  writeRaw(keyFor(address), JSON.stringify(state))
}

/** Read, mutate, write. Every mutation goes through here so none can forget to persist. */
function update(address: string, mutate: (state: SocialState) => void): void {
  if (!address) return
  const state = readState(address)
  mutate(state)
  writeState(address, state)
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

/**
 * Deterministic id: hash of what identifies the item, base36.
 *
 * `index` is the store's current length, so two items created in the same
 * millisecond between the same pair still differ. Two independent hashes are
 * concatenated for 64 bits of space, which keeps the birthday bound far beyond
 * anything a local inbox can hold.
 */
function makeId(kind: string, from: string, to: string, at: number, index: number): string {
  const seed = `${kind}:${from}:${to}:${at}:${index}`
  return hashString(seed).toString(36) + hashString(`${seed}#`).toString(36)
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** xNet handle when the address is a known wallet, truncated address otherwise. */
export function handleFor(now: number, address: string): string {
  const wallet = walletByAddress(now, address)
  if (wallet) return wallet.handle
  return address.length > 10 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

// Traders talking shop: short, lowercase, about desks and contracts rather than
// about the app. {x} resolves to one of the sender's real serials, {d} to a desk
// ticker they actually work — the flavour has to survive a click through to the
// wallet page.
const OPENERS = [
  'saw your book on the tape. moving anything this epoch?',
  'putting {x} up before the next epoch. want first look?',
  'my {d} desk is printing. what are you running?',
  'need one more X-RATED to close a set. what do you hold?',
  '{x} rolls off contract friday. open to offers on it.',
  'you sweeping the {d} desk? clean fills, respect.',
  'rotating out of {d} into something with more skills. interested?',
]

const FOLLOWUPS = [
  'no rush. offer stands through the epoch.',
  'ignore that, filled it elsewhere. still worth talking.',
  'ping me before you list, i pay over book.',
  'also: your avg apy is filthy. what desk?',
  'bumping this. quote me anything.',
]

const NOTES = [
  'clean unit, never listed. firm.',
  'need the xNFT for a hire this epoch. cheap for what it is.',
  'downsizing the desk. take it or leave it.',
  'first offer i have sent all epoch. do not sit on it.',
]

function fillTemplate(rng: Rng, wallet: NetworkWallet, template: string): string {
  const id = wallet.xployeeIds.length > 0 ? pick(rng, wallet.xployeeIds) : 0
  const x = byId(id)
  const ticker = x && x.skills.length > 0 ? pick(rng, x.skills).skill.ticker : 'SPYx'
  return template.replace('{x}', serial(id)).replace('{d}', ticker)
}

/**
 * Starter content, written once.
 *
 * An inbox that opens empty reads as broken, so the first load fabricates a
 * short history against real xNet wallets: two live threads with friends, one
 * pending friend request and one pending offer.
 *
 * Additive by construction. It only ever pushes, and it skips any counterparty
 * the visitor has already dealt with, so there is no path where seeding can
 * overwrite or duplicate real user data — even if the flag were somehow lost.
 */
function seed(state: SocialState, address: string, now: number): void {
  const wallets = networkWallets(now)
  if (wallets.length < 4) return

  // Ordered by address rather than by value, so the cast does not change as the
  // clock moves portfolios around the leaderboard.
  const pool = [...wallets].sort((a, b) => (a.address < b.address ? -1 : 1))
  const rng = rngFrom('social', 'seed', address)
  // Weighted by holdings — a big desk is the one that reaches out first.
  const [pal, mate, suitor, dealer] = pickDistinct(rng, pool, 4, (w) => w.holdings)

  const known = new Set<string>(state.friends)
  for (const m of state.messages) known.add(m.from === address ? m.to : m.from)
  for (const r of state.requests) known.add(r.from === address ? r.to : r.from)
  for (const o of state.offers) known.add(o.from === address ? o.to : o.from)

  // An old friend with an unread thread: opener plus a follow-up nudge.
  if (!known.has(pal.address)) {
    const opened = now - randInt(rng, 30, 96) * HOUR_MS
    state.requests.push({
      id: makeId('friend', pal.address, address, opened - HOUR_MS, state.requests.length),
      from: pal.address,
      to: address,
      at: opened - HOUR_MS,
      status: 'accepted',
    })
    state.friends.push(pal.address)
    state.messages.push({
      id: makeId('msg', pal.address, address, opened, state.messages.length),
      from: pal.address,
      to: address,
      body: fillTemplate(rng, pal, pick(rng, OPENERS)),
      at: opened,
      read: false,
    })
    const nudge = opened + randInt(rng, 1, 20) * HOUR_MS
    state.messages.push({
      id: makeId('msg', pal.address, address, nudge, state.messages.length),
      from: pal.address,
      to: address,
      body: pick(rng, FOLLOWUPS),
      at: nudge,
      read: false,
    })
  }

  // A friend the visitor added themselves, mid-conversation.
  if (!known.has(mate.address)) {
    const added = now - randInt(rng, 40, 120) * HOUR_MS
    state.requests.push({
      id: makeId('friend', address, mate.address, added, state.requests.length),
      from: address,
      to: mate.address,
      at: added,
      status: 'accepted',
    })
    state.friends.push(mate.address)
    const at = now - randInt(rng, 2, 28) * HOUR_MS
    state.messages.push({
      id: makeId('msg', mate.address, address, at, state.messages.length),
      from: mate.address,
      to: address,
      body: fillTemplate(rng, mate, pick(rng, OPENERS)),
      at,
      read: false,
    })
  }

  // A stranger wanting in.
  if (!known.has(suitor.address)) {
    const at = now - randInt(rng, 1, 12) * HOUR_MS
    state.requests.push({
      id: makeId('friend', suitor.address, address, at, state.requests.length),
      from: suitor.address,
      to: address,
      at,
      status: 'pending',
    })
  }

  // A live offer. The dealer puts up units it genuinely holds and wants $xNFT
  // back — negative xnft — so the offer is priced rather than a gift.
  if (!known.has(dealer.address) && dealer.xployeeIds.length > 0) {
    const at = now - randInt(rng, 1, 18) * HOUR_MS
    const count = Math.min(dealer.xployeeIds.length, randInt(rng, 1, 2))
    const offering = pickDistinct(rng, dealer.xployeeIds, count)
    state.offers.push({
      id: makeId('offer', dealer.address, address, at, state.offers.length),
      from: dealer.address,
      to: address,
      offering: [...offering].sort((a, b) => a - b),
      requesting: [],
      xnft: -randInt(rng, 4, 24) * 50,
      status: 'pending',
      at,
      note: pick(rng, NOTES),
    })
  }
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function project(state: SocialState, address: string, now: number): Inbox {
  const byPeer = new Map<string, Message[]>()
  for (const m of state.messages) {
    // A hand-edited store must not be able to inject somebody else's mail.
    if (m.from !== address && m.to !== address) continue
    const peer = m.from === address ? m.to : m.from
    const list = byPeer.get(peer)
    if (list) list.push(m)
    else byPeer.set(peer, [m])
  }

  const threads: Thread[] = []
  for (const [peer, messages] of byPeer) {
    messages.sort((a, b) => a.at - b.at)
    threads.push({
      with: peer,
      handle: handleFor(now, peer),
      lastAt: messages[messages.length - 1].at,
      unread: messages.filter((m) => m.to === address && !m.read).length,
      messages,
    })
  }
  threads.sort((a, b) => b.lastAt - a.lastAt)

  // Only pending requests are inbox items — a resolved one is history, and
  // history belongs on the friends list, not on the badge.
  const incomingRequests = state.requests.filter((r) => r.to === address && r.status === 'pending')
  const outgoingRequests = state.requests.filter((r) => r.from === address && r.status === 'pending')
  // Same guard as the messages loop: an offer between two third parties would
  // render as one the visitor sent, priced against units they never held.
  const offers = state.offers
    .filter((o) => o.from === address || o.to === address)
    .sort((a, b) => b.at - a.at)

  const unreadMessages = threads.reduce((sum, t) => sum + t.unread, 0)
  const pendingOffers = offers.filter((o) => o.to === address && o.status === 'pending').length

  return {
    threads,
    friends: [...state.friends],
    incomingRequests,
    outgoingRequests,
    offers,
    unreadTotal: unreadMessages + incomingRequests.length + pendingOffers,
  }
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * The visitor's state, seeded on first touch.
 *
 * Seeding on read is deliberate: whichever surface they open first — the inbox
 * or their own profile's friends list — is the one that populates it, and the
 * flag persists in the same write so it happens exactly once.
 */
function ensureSeeded(address: string, now: number): SocialState {
  const state = readState(address)
  if (state.seeded) return state
  seed(state, address, now)
  state.seeded = true
  writeState(address, state)
  return state
}

export function loadInbox(address: string, now: number): Inbox {
  if (!address) return emptyInbox()
  return project(ensureSeeded(address, now), address, now)
}

export function sendMessage(address: string, to: string, body: string, now: number): void {
  if (!address || !to || to === address) return
  const text = body.trim()
  if (text.length === 0 || text.length > MESSAGE_MAX) return
  update(address, (state) => {
    state.messages.push({
      id: makeId('msg', address, to, now, state.messages.length),
      from: address,
      to,
      body: text,
      at: now,
      // Your own message is never unread to you.
      read: true,
    })
  })
}

export function markThreadRead(address: string, withAddress: string): void {
  if (!address || !withAddress) return
  update(address, (state) => {
    for (const m of state.messages) {
      if (m.from === withAddress && m.to === address) m.read = true
    }
  })
}

export function sendFriendRequest(address: string, to: string, now: number): void {
  if (!address || !to || to === address) return
  update(address, (state) => {
    if (state.friends.includes(to)) return
    // A pending request in either direction is already an open question. A second
    // one would only add a duplicate row to two inboxes.
    const open = state.requests.some(
      (r) =>
        r.status === 'pending' &&
        ((r.from === address && r.to === to) || (r.from === to && r.to === address)),
    )
    if (open) return
    state.requests.push({
      id: makeId('friend', address, to, now, state.requests.length),
      from: address,
      to,
      at: now,
      status: 'pending',
    })
  })
}

export function respondToFriendRequest(address: string, id: string, accept: boolean): void {
  if (!address || !id) return
  update(address, (state) => {
    // Incoming and still open only — you cannot answer on someone else's behalf.
    const req = state.requests.find(
      (r) => r.id === id && r.to === address && r.status === 'pending',
    )
    if (!req) return
    req.status = accept ? 'accepted' : 'declined'
    if (accept && !state.friends.includes(req.from)) state.friends.push(req.from)
  })
}

export function removeFriend(address: string, other: string): void {
  if (!address || !other) return
  update(address, (state) => {
    // The accepted request stays as history; `friends` is what everything reads,
    // and leaving the record behind means a later re-add is not blocked as a dupe.
    state.friends = state.friends.filter((a) => a !== other)
  })
}

export function isFriend(address: string, other: string): boolean {
  if (!address || !other) return false
  return readState(address).friends.includes(other)
}

export function sendTradeOffer(address: string, offer: TradeOfferDraft, now: number): void {
  const to = str(offer.to)
  if (!address || !to || to === address) return

  const offering = xployeeIds(offer.offering)
  // The same unit cannot be on both sides of a trade.
  const requesting = xployeeIds(offer.requesting).filter((id) => !offering.includes(id))
  const sweetener = num(offer.xnft)
  // An offer that moves nothing in either direction is not an offer.
  if (offering.length === 0 && requesting.length === 0 && sweetener === 0) return

  update(address, (state) => {
    state.offers.push({
      id: makeId('offer', address, to, now, state.offers.length),
      from: address,
      to,
      offering,
      requesting,
      xnft: sweetener,
      status: 'pending',
      at: now,
      note: str(offer.note).trim().slice(0, MESSAGE_MAX),
    })
  })
}

/**
 * Resolve an offer. Accepting only records the decision — there is no custody
 * here, so nothing changes hands; the ledger this would settle against does not
 * exist on the client.
 */
export function respondToOffer(address: string, id: string, status: OfferStatus): void {
  if (!address || !id || status === 'pending') return
  update(address, (state) => {
    const offer = state.offers.find((o) => o.id === id && o.status === 'pending')
    if (!offer) return
    // You withdraw your own offers and accept or decline everyone else's.
    if (status === 'withdrawn') {
      if (offer.from !== address) return
    } else if (offer.to !== address) return
    offer.status = status
  })
}

/**
 * Wipe this wallet's social state. The key goes entirely, so the next load
 * re-seeds — a reset means "back to how it shipped", not "empty forever".
 */
export function clearSocial(address: string): void {
  if (!address) return
  removeRaw(keyFor(address))
}

/**
 * Probability that any two simulated wallets know each other. Across 96
 * candidates this averages just under six friends per wallet, with enough
 * spread that some desks are clearly better connected than others.
 */
const SIM_FRIEND_P = 0.06

/**
 * Symmetric by construction: the seed is the unordered pair, so A lists B
 * exactly when B lists A. A per-wallet roll would produce one-way friendships
 * that look like a bug the moment you click through to the other profile.
 */
function pairRoll(a: string, b: string): number {
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  return rngFrom('social', 'friend', lo, hi)()
}

export function friendsOf(address: string, now: number): string[] {
  if (!address) return []
  // Only simulated wallets live in network.ts; anything else is the visitor's
  // own connected wallet, whose friends are real and stored.
  if (!walletByAddress(now, address)) return [...ensureSeeded(address, now).friends]

  const out: string[] = []
  for (const w of networkWallets(now)) {
    if (w.address === address) continue
    if (pairRoll(address, w.address) < SIM_FRIEND_P) out.push(w.address)
  }
  return out.sort()
}
