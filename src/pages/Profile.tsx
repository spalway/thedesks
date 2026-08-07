import { useEffect, useState } from 'react'
import { Panel, Empty, Button, Chip } from '../components/ui'
import { ProfileView } from '../components/ProfileView'
import { XployeeArt } from '../components/XployeeArt'
import { useWallet } from '../lib/wallet'
import { useHoldings } from '../lib/useHoldings'
import { useNow } from '../lib/useNow'
import { loadInbox, handleFor } from '../lib/social'
import {
  loadProfile,
  saveProfile,
  validateProfile,
  EMPTY_PROFILE,
  type Profile as ProfileData,
} from '../lib/profile'
import { serial } from '../lib/xployee'

export function Profile() {
  const { address } = useWallet()
  const holdings = useHoldings()
  const now = useNow(5000)

  const [draft, setDraft] = useState<ProfileData>(EMPTY_PROFILE)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (address) setDraft(loadProfile(address))
  }, [address])

  if (!address) {
    return (
      <Panel title="Profile">
        <Empty title="Wallet not connected">
          Connect a Solana wallet from the header to set up your profile.
        </Empty>
      </Panel>
    )
  }

  const errors = validateProfile(draft)
  const errorFor = (field: keyof ProfileData) => errors.find((e) => e.field === field)?.message

  const inbox = loadInbox(address, now)
  const friends = inbox.friends.map((a) => ({ address: a, handle: handleFor(now, a) }))

  const commit = () => {
    if (errors.length > 0) return
    // `twitter: ''` is written deliberately and is not a leftover.
    //
    // The handle used to be a text field here, and earlier builds persisted
    // whatever was typed into it to localStorage. Deleting the input closes the
    // path for new entries but does nothing about a browser that already has one
    // stored — that value would keep rendering, next to a verified tick, forever.
    // So every save clears it, and the ONLY handle this page displays is the one
    // `useAuth` read back out of a completed OAuth exchange.
    saveProfile(address, { ...draft, twitter: '' })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  // min-h-11 on the single-line fields — they rendered at 36px, under the 44px
  // touch target. The textarea overrides it with its own h-20.
  const field =
    'min-h-11 w-full border border-ink bg-paper px-3 py-2 text-[11px] outline-none focus:bg-wash'

  return (
    <ProfileView
      profile={{
        ...draft,
        address,
        displayName: draft.username || handleFor(now, address),
        // X linking was removed. Nothing verifies a handle any more, so the profile
        // never claims one — an unverifiable @ next to a wallet is worse than none.
        twitter: '',
        isOwn: true,
      }}
      crew={holdings.xployees}
      now={now}
      friends={friends}
      editSlot={
        <div className="space-y-5">
          <Panel title="Edit Profile">
            <div className="space-y-4">
              <label className="block sm:max-w-sm">
                <span className="ui ui-10 text-ink-mute">Username</span>
                <input
                  className={`${field} mt-1.5`}
                  value={draft.username}
                  maxLength={20}
                  placeholder="3–20 chars, letters/numbers/_"
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                />
                {errorFor('username') ? (
                  <span className="mt-1 block text-[10px] text-down">{errorFor('username')}</span>
                ) : (
                  <span className="mt-1 block text-[10px] text-ink-faint">
                    A nickname for this wallet. It is not a claim about any account elsewhere.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="ui ui-10 text-ink-mute">Bio</span>
                <textarea
                  className={`${field} mt-1.5 h-20 resize-none`}
                  value={draft.bio}
                  maxLength={160}
                  placeholder="160 characters — shown under your xBoss tag"
                  onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                />
                <span className="mt-1 block text-right text-[10px] text-ink-faint">{draft.bio.length}/160</span>
              </label>

              <div>
                <span className="ui ui-10 text-ink-mute">Showcase — pick your pfp</span>
                {holdings.count === 0 ? (
                  <div className="mt-2 border border-dashed border-rule px-4 py-6 text-center text-[10px] text-ink-faint">
                    Hire an xployee and it can become your profile picture.
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {holdings.xployees.map((x) => {
                      const active = draft.pfpXployeeId === x.id
                      return (
                        <button
                          key={x.id}
                          onClick={() => setDraft({ ...draft, pfpXployeeId: x.id })}
                          className={`border p-1 transition-colors ${
                            active ? 'border-ink bg-ink' : 'border-rule hover:border-ink'
                          }`}
                          title={`${serial(x.id)} — ${x.tier.label}`}
                        >
                          <XployeeArt xployee={x} size={64} animated={false} />
                          <span className={`mono mt-1 block text-[10px] ${active ? 'text-paper' : 'text-ink-mute'}`}>
                            {serial(x.id)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={commit} disabled={errors.length > 0}>
                  Save profile
                </Button>
                {saved ? <Chip tone="ink">Saved</Chip> : null}
                {errors.length > 0 ? <Chip tone="outline">{errors.length} to fix</Chip> : null}
              </div>
            </div>
          </Panel>
        </div>
      }
    />
  )
}

