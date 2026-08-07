// React state around the burn-to-mint flow in ./solana.
//
// The hook reads balances on its own, but it never burns on its own: `burn()`
// exists to be wired to a click handler. Mounting this hook, changing wallets, or
// re-rendering can only ever cost an RPC read.
//
// It is also the only writer the `mints` and `fee_ledger` tables have. With no
// program there is no event for a backfill to scan for, so a mint that is never
// posted here is a mint the index never learns about — see indexSignature().
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Transaction } from '@solana/web3.js'
import {
  fetchXnftBalance,
  isBurnError,
  sendBurn,
  type BurnError,
  type BurnStage,
  type TokenBalance,
} from './solana'
import { ingestSignature } from './supabase'

export interface BurnState {
  stage: BurnStage
  error: BurnError | null
  signature: string | null
  balance: TokenBalance | null
  refreshBalance: () => Promise<void>
  burn: (signAndSend: (tx: Transaction) => Promise<string>) => Promise<boolean>
  reset: () => void
}

/**
 * Hands a landed mint's signature to the indexer and forgets it.
 *
 * Fire-and-forget, and the direction of that choice is the whole point: by the
 * time this runs the tokens are gone and the transaction is on-chain, so an index
 * that is down, unconfigured or merely slow must never turn a successful mint
 * into a failure on screen. The result is not awaited, not surfaced and not
 * retried — a visitor cannot fix Supabase, and offering them a "retry" next to an
 * irreversible burn is how a second one gets signed.
 *
 * The post carries only the signature. The Edge Function re-reads the transaction
 * from RPC and writes the burn, the fee and the buyer from its own decoding, so
 * there is nothing here that could misreport an amount, and posting the same
 * signature twice is a no-op server-side.
 */
function indexSignature(signature: string): void {
  // ingestSignature resolves its failures as values rather than rejecting; the
  // catch is for a genuine crash, so that a broken index cannot produce an
  // unhandled rejection out of a path that has already succeeded.
  void ingestSignature(signature).catch(() => {})
}

export function useBurn(address: string | null): BurnState {
  const [stage, setStage] = useState<BurnStage>('idle')
  const [error, setError] = useState<BurnError | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [balance, setBalance] = useState<TokenBalance | null>(null)

  // Mirrored so guards can read the current stage without re-creating callbacks.
  const stageRef = useRef<BurnStage>('idle')
  // One burn at a time: a double-click must not produce two irreversible sends.
  const burning = useRef(false)
  // Only the newest balance read may write — a slow one must not overwrite it.
  const readSeq = useRef(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const goto = useCallback((next: BurnStage) => {
    stageRef.current = next
    setStage(next)
  }, [])

  const refreshBalance = useCallback(async () => {
    const seq = ++readSeq.current

    if (!address) {
      setBalance(null)
      return
    }

    // A passive read only drives the stage when nothing else owns it, so it can
    // never wipe a 'done' or 'error' the visitor still needs to see.
    const owned = stageRef.current === 'idle'
    if (owned) goto('checking')

    const result = await fetchXnftBalance(address)
    if (!alive.current || seq !== readSeq.current) return

    // Re-checked here, not just at the top: a burn can start while this read is in
    // flight and it then owns 'checking'. Without this the read would drop the
    // stage back to 'idle' mid-burn and re-enable the button under the visitor.
    const stillOurs = owned && !burning.current

    if (isBurnError(result)) {
      setBalance(null)
      // Surface config/RPC problems only while idle — a burn's own error wins.
      if (stillOurs && stageRef.current === 'checking') setError(result)
    } else {
      setBalance(result)
    }

    if (stillOurs && stageRef.current === 'checking') goto('idle')
  }, [address, goto])

  const reset = useCallback(() => {
    setError(null)
    setSignature(null)
    goto('idle')
  }, [goto])

  const burn = useCallback(
    async (signAndSend: (tx: Transaction) => Promise<string>): Promise<boolean> => {
      if (burning.current) return false

      if (!address) {
        setError({ code: 'no-wallet', message: 'Connect a Solana wallet before burning.' })
        goto('error')
        return false
      }

      burning.current = true
      setError(null)
      setSignature(null)
      goto('checking')

      try {
        const result = await sendBurn(address, async (tx) => {
          // Stage flips around the wallet call, not inside sendBurn, so the UI
          // reflects exactly which half of the flow is waiting on whom.
          if (alive.current) goto('awaiting-signature')
          const sig = await signAndSend(tx)
          if (alive.current) goto('confirming')
          return sig
        })

        // Posted before the unmount check, not after it. A visitor who navigates
        // away the instant the wallet returns has still minted, and this is the
        // only place that signature is ever seen.
        if (!isBurnError(result)) indexSignature(result.signature)

        if (!alive.current) return !isBurnError(result)

        if (isBurnError(result)) {
          setError(result)
          goto('error')
          return false
        }

        setSignature(result.signature)
        goto('done')
        return true
      } finally {
        burning.current = false
        // Balance is stale either way: a rejected burn still may have raced a transfer.
        void refreshBalance()
      }
    },
    [address, goto, refreshBalance],
  )

  // Switching wallets shows a different balance and must not inherit the previous
  // wallet's result. Reads only — this never triggers a burn.
  useEffect(() => {
    if (burning.current) return
    setError(null)
    setSignature(null)
    stageRef.current = 'idle'
    setStage('idle')
    void refreshBalance()
  }, [refreshBalance])

  return { stage, error, signature, balance, refreshBalance, burn, reset }
}
