// Public-facing profile for any wallet on xNET.
//
// The visitor's own profile is real, editable and stored locally. Everyone
// else's is generated deterministically from their address, so clicking through
// to another trader shows a populated profile instead of an empty shell — the
// directory would feel dead otherwise.
import { rngFrom, pick, randInt } from './rng'
import { loadProfile, type Profile } from './profile'
import { byId } from './collection'
import type { NetworkWallet } from './network'
import type { Xployee } from './xployee'

const BIO_OPENERS = [
  'Running a tight desk.',
  'Long the boring stuff.',
  'Here for the dividends, staying for the drama.',
  'Payroll is a portfolio.',
  'I hire, I never fire.',
  'Building a crew, one epoch at a time.',
  'Quietly compounding.',
  'My xployees work harder than I do.',
  'Contracts out, yield in.',
  'Small crew, high conviction.',
  'Collecting desks like baseball cards.',
  'Never sold an X-RATED. Never will.',
] as const

const BIO_CLOSERS = [
  'DMs open for contracts.',
  'Will trade for semis exposure.',
  'Not selling the flagship.',
  'Always bidding the floor.',
  'Ask me about the bills desk.',
  'Taking offers on the bench.',
  'Buying anything with a Chain Teller.',
  'Yield is the only scoreboard.',
  '',
  '',
] as const

const HANDLE_SUFFIX = ['', '', '_xyz', '.sol', '_eth', '01', '_hq'] as const

export interface PublicProfile extends Profile {
  address: string
  /** Display name — the stored username, else the network handle. */
  displayName: string
  /** True when this is the connected visitor's own profile. */
  isOwn: boolean
}

/**
 * Build the profile to render for a wallet.
 *
 * `viewer` is the connected address, or null. When it matches, the stored
 * (editable) profile wins; otherwise the wallet gets its generated one.
 */
export function publicProfileFor(wallet: NetworkWallet, viewer: string | null): PublicProfile {
  const isOwn = viewer !== null && viewer === wallet.address

  if (isOwn) {
    const stored = loadProfile(wallet.address)
    return {
      ...stored,
      address: wallet.address,
      displayName: stored.username || wallet.handle,
      isOwn: true,
    }
  }

  const rng = rngFrom('publicprofile', wallet.address)
  const opener = pick(rng, BIO_OPENERS)
  const closer = pick(rng, BIO_CLOSERS)
  const bio = closer ? `${opener} ${closer}` : opener

  // Roughly two thirds of traders link a socials account.
  const hasTwitter = rng() < 0.68
  const twitter = hasTwitter ? `${wallet.handle}${pick(rng, HANDLE_SUFFIX)}`.slice(0, 15) : ''

  // Their pfp is one of their own xployees, biased toward the rarest.
  const crew = wallet.xployeeIds.map((id) => byId(id)).filter((x): x is Xployee => Boolean(x))
  const sorted = [...crew].sort((a, b) => b.tier.skills - a.tier.skills)
  const pick_ = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, randInt(rng, 0, 1))] : null

  return {
    address: wallet.address,
    username: wallet.handle,
    displayName: wallet.handle,
    bio,
    twitter,
    pfpXployeeId: pick_ ? pick_.id : null,
    isOwn: false,
  }
}

/** The crew a wallet controls, rarest first. */
export function crewOf(wallet: NetworkWallet): Xployee[] {
  return wallet.xployeeIds
    .map((id) => byId(id))
    .filter((x): x is Xployee => Boolean(x))
    .sort((a, b) => b.tier.skills - a.tier.skills || a.id - b.id)
}
