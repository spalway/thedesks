// Public-facing profile for any wallet on xNET.
//
// The visitor's own profile is real, editable and stored locally. Everyone
// else's is whatever they have actually published, which before anyone has
// published anything is nothing.
//
// This used to invent one: a bio drawn from a table of twelve openers and eight
// closers, and a Twitter handle for roughly two thirds of wallets. That filled
// out a directory of 97 fabricated traders. There is now exactly one wallet on
// the network — the project's own — so the generator's entire output would have
// been a made-up bio and a made-up social link attached to the operator's real
// address. A blank profile is the truth and the UI already renders it.
import { loadProfile, type Profile } from './profile'
import { byId } from './collection'
import type { NetworkWallet } from './network'
import type { Xployee } from './xployee'

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

  // The rarest xployee they hold. Not invented — it is derived from what the
  // wallet actually owns, and it is null for a wallet that owns nothing.
  const rarest = crewOf(wallet)[0] ?? null

  return {
    address: wallet.address,
    username: wallet.handle,
    displayName: wallet.handle,
    bio: '',
    twitter: '',
    pfpXployeeId: rarest ? rarest.id : null,
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
