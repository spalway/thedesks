// Friends, direct messages and trade offers — the social layer over the xNet.
//
// There is no server. Everything here is what the visitor themselves did,
// stored in localStorage under a single key per wallet address.
//
// Nothing is fabricated. There used to be a seeder that wrote starter content
// on first load — two live threads, a pending friend request, a priced trade
// offer — drawn against wallets from network.ts, plus a `pairRoll` that
// manufactured a friend graph across them. Both were built when those wallets
// were invented. They are real addresses now, so a generator that puts words in
// their mouths or asserts who they know is not flavour, it is fabrication about
// actual users. An inbox that opens empty on day one is correct.
//
// One rule shapes the rest of the file: reads never throw. Corrupt JSON, a
// hand-edited entry, blocked storage or an exhausted quota all degrade to an
// empty inbox on a page that is otherwise fine.
import { walletByAddress } from './network'
import { hashString } from './rng'

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
  messages: Message[]
  /** Both directions, all statuses — the audit trail behind `friends`. */
  requests: FriendRequest[]
  friends: string[]
  offers: TradeOffer[]
}

const STATE_VERSION = 1

function emptyState(): SocialState {
  return { v: STATE_VERSION, messages: [], requests: [], friends: [], offers: [] }
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

export function loadInbox(address: string, now: number): Inbox {
  if (!address) return emptyInbox()
  return project(readState(address), address, now)
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

/** Wipe this wallet's social state. */
export function clearSocial(address: string): void {
  if (!address) return
  removeRaw(keyFor(address))
}

/**
 * Who this wallet has actually added.
 *
 * One list, stored, for every address. There used to be two paths: a stored one
 * for the visitor, and for any wallet on xNET a roll of `pairRoll` at 6% against
 * every other wallet, which manufactured a plausible social graph across the 97
 * fabricated traders.
 *
 * That second path was a fuse. xNET is now real wallets — everyone who mints
 * lands in it — so as the network grew the roll would have started asserting
 * friendships between real strangers who had never met, on their real
 * addresses, with no way for either to remove one. Same reason the inbox
 * seeder is gone: it fabricated DMs and trade offers *from* those wallets.
 */
export function friendsOf(address: string): string[] {
  if (!address) return []
  return [...readState(address).friends]
}
