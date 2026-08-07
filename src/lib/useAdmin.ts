// The admin desk's two gates, and an honest account of what each is worth.
//
// GATE 1 — the passcode. It is a UI speed bump and NOTHING MORE. Anything this
// bundle can check, a visitor can bypass: they hold the code, they can read it
// in devtools, and they can flip the boolean it produces. What is stored below
// is a SHA-256 digest rather than the passcode itself, which keeps the plaintext
// out of a file every visitor downloads — but a digest of a short human password
// falls to a wordlist in seconds, so this is hygiene, not protection. Do not
// describe it to an operator as security; the page says so on screen.
//
// GATE 2 — the dev wallet. This one is real. Paying a request requires a
// signature from the keypair that holds the SOL, and no amount of client-side
// tampering produces one. Every action that moves money hangs off this gate, and
// the passcode gates nothing but which pixels render.
import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * SHA-256 of the operator passcode.
 *
 * Overridable at build time so an operator can rotate it without a code change;
 * the default is the one this project shipped with. A digest is safe to commit
 * in a way the passcode is not — but see the header: neither is a real control.
 */
const PASSCODE_DIGEST =
  import.meta.env.VITE_ADMIN_PASSCODE_SHA256 ??
  '6b8de5775d08b607d6f2f906a8dc524bebac37a233b51d8bb6695ba29cd2688b'

/** Survives a reload so an operator working a queue is not re-prompted constantly. */
const SESSION_KEY = 'xnfts:admin:unlocked'

async function digest(input: string): Promise<string | null> {
  // Subtle crypto is https-or-localhost only. A build served over plain http on
  // a LAN address has no `subtle`, and returning null there is deliberate: the
  // page then refuses to unlock rather than silently comparing something else.
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface AdminGate {
  unlocked: boolean
  checking: boolean
  /** Populated only after a failed attempt, so the field starts quiet. */
  error: string | null
  submit: (passcode: string) => Promise<void>
  lock: () => void
}

export function useAdminGate(): AdminGate {
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(SESSION_KEY) === '1')
    } catch {
      // Private mode or a blocked store. Staying locked is the safe direction.
    }
  }, [])

  const submit = useCallback(async (passcode: string) => {
    setChecking(true)
    setError(null)
    const got = await digest(passcode)
    setChecking(false)

    if (got === null) {
      setError('This browser cannot hash the passcode — the page must be served over HTTPS or localhost.')
      return
    }
    if (got !== PASSCODE_DIGEST) {
      setError('Incorrect passcode.')
      return
    }
    setUnlocked(true)
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      // Unlocked for this render either way; it just will not survive a reload.
    }
  }, [])

  const lock = useCallback(() => {
    setUnlocked(false)
    setError(null)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* nothing to clear */
    }
  }, [])

  return useMemo(
    () => ({ unlocked, checking, error, submit, lock }),
    [unlocked, checking, error, submit, lock],
  )
}
