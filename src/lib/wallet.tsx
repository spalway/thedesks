// Wallet Standard connect, plus one narrowly-scoped signing path.
//
// Deliberately not @solana/wallet-adapter: that pulls a styled modal we'd have
// to fight. This detects injected Solana wallets directly and renders in the
// app's own aesthetic.
//
// Signing exists for exactly one purpose — the 10,000 $xNFT burn that gates
// minting. Nothing else in the app calls it, and it is never invoked except
// from an explicit click. Everything else remains read-only.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getWallets } from '@wallet-standard/app'
import type { Transaction } from '@solana/web3.js'

export interface DetectedWallet {
  name: string
  icon?: string
}

interface WalletState {
  wallets: DetectedWallet[]
  address: string | null
  connecting: boolean
  error: string | null
  connect: (name: string) => Promise<void>
  disconnect: () => void
  /**
   * Signs and sends a transaction, returning its signature.
   *
   * Null when no wallet is connected or the connected wallet cannot sign — the
   * caller must treat that as "burning is unavailable", not as a silent no-op.
   */
  signAndSendTransaction: ((tx: Transaction) => Promise<string>) | null
}

const Ctx = createContext<WalletState | null>(null)

const STORAGE_KEY = 'xnfts:wallet'

/** Minimal shapes we need from the Wallet Standard registry. */
type StandardAccount = { address: string; features?: readonly string[] }
type StandardWallet = {
  name: string
  icon?: string
  chains?: readonly string[]
  features: Record<string, unknown>
  accounts: readonly StandardAccount[]
}

type SignAndSendFeature = {
  signAndSendTransaction: (input: {
    account: StandardAccount
    chain: string
    transaction: Uint8Array
  }) => Promise<readonly { signature: Uint8Array }[]>
}

const SIGN_AND_SEND = 'solana:signAndSendTransaction'

function isSolanaWallet(w: StandardWallet): boolean {
  return 'standard:connect' in w.features && Object.keys(w.features).some((f) => f.startsWith('solana:'))
}

/** base58 encode — wallets return raw signature bytes, explorers want base58. */
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function base58(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const digits: number[] = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  // Leading zero bytes become leading '1's.
  let out = ''
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += '1'
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]]
  return out
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallets, setWallets] = useState<DetectedWallet[]>([])
  const [address, setAddress] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The live wallet + account behind the connected address. Held in a ref
  // because it is a handle to an injected object, not render state.
  const registry = useRef(getWallets())
  const active = useRef<{ wallet: StandardWallet; account: StandardAccount } | null>(null)

  // Wallets register asynchronously, so listen rather than reading once.
  useEffect(() => {
    const reg = registry.current
    const sync = () => {
      const found = (reg.get() as unknown as StandardWallet[]).filter(isSolanaWallet)
      setWallets(found.map((w) => ({ name: w.name, icon: w.icon })))
    }
    sync()
    const offRegister = reg.on('register', sync)
    const offUnregister = reg.on('unregister', sync)
    return () => {
      offRegister()
      offUnregister()
    }
  }, [])

  // Restore a prior session's address for display continuity. This does NOT
  // restore signing ability — that requires a live connect.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setAddress(saved)
    } catch {
      // Private mode. Display-only continuity is not worth failing over.
    }
  }, [])

  const connect = useCallback(async (name: string) => {
    setConnecting(true)
    setError(null)
    try {
      const found = (registry.current.get() as unknown as StandardWallet[])
        .filter(isSolanaWallet)
        .find((w) => w.name === name)
      if (!found) throw new Error(`${name} is not available`)

      const feature = found.features['standard:connect'] as
        | { connect: () => Promise<{ accounts: readonly StandardAccount[] }> }
        | undefined
      if (!feature?.connect) throw new Error(`${name} does not support connect`)

      const result = await feature.connect()
      const account = result.accounts[0] ?? found.accounts[0]
      if (!account) throw new Error(`${name} returned no account`)

      active.current = { wallet: found, account }
      setAddress(account.address)
      try {
        localStorage.setItem(STORAGE_KEY, account.address)
      } catch {
        // Non-fatal.
      }
    } catch (e) {
      // Rejection is normal and recoverable — surface it, don't crash.
      setError(e instanceof Error ? e.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    active.current = null
    setAddress(null)
    setError(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Non-fatal.
    }
  }, [])

  const signAndSendTransaction = useMemo(() => {
    if (!address) return null
    return async (tx: Transaction): Promise<string> => {
      const current = active.current
      if (!current) {
        // A restored-from-storage session can display an address without a live
        // wallet handle. Say so plainly rather than failing cryptically.
        throw new Error('Reconnect your wallet before signing')
      }
      const feature = current.wallet.features[SIGN_AND_SEND] as SignAndSendFeature | undefined
      if (!feature?.signAndSendTransaction) {
        throw new Error(`${current.wallet.name} cannot sign and send transactions`)
      }

      const chain =
        current.wallet.chains?.find((c) => c.startsWith('solana:')) ?? 'solana:mainnet'

      const serialised = tx.serialize({ requireAllSignatures: false, verifySignatures: false })
      const [result] = await feature.signAndSendTransaction({
        account: current.account,
        chain,
        transaction: new Uint8Array(serialised),
      })
      if (!result?.signature) throw new Error('Wallet returned no signature')
      return base58(result.signature)
    }
  }, [address])

  const value = useMemo<WalletState>(
    () => ({ wallets, address, connecting, error, connect, disconnect, signAndSendTransaction }),
    [wallets, address, connecting, error, connect, disconnect, signAndSendTransaction],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWallet(): WalletState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider')
  return ctx
}
