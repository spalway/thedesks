// The point of moving deployment config out of VITE_ variables was that a value
// could change WITHOUT a rebuild. These tests pin that property, plus the two
// ways it could go wrong: config that arms something it should not, and config
// that gets cached at import time and therefore never changes at all.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRuntimeConfig,
  isMintArmed,
  subscribeRuntimeConfig,
  __setRuntimeConfigForTests,
  __resetRuntimeConfigForTests,
} from './runtimeConfig'
import { xnftMintAddress, devWalletAddress, treasuryAddress, isMintConfigured } from './spl'
import { xnftCa, isTokenLaunched } from './token'

const MINT = 'Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh'
const WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'

const armed = {
  xnftMint: MINT,
  devWallet: WALLET,
  treasuryWallet: WALLET,
  mintingEnabled: true,
  loaded: true,
  source: 'supabase' as const,
}

beforeEach(() => {
  __resetRuntimeConfigForTests()
})

describe('runtime config replaces build-time constants', () => {
  it('starts empty and disarmed, exactly like the old empty constants', () => {
    expect(getRuntimeConfig().xnftMint).toBe('')
    expect(getRuntimeConfig().loaded).toBe(false)
    expect(isMintArmed()).toBe(false)
    expect(isMintConfigured()).toBe(false)
    expect(isTokenLaunched()).toBe(false)
  })

  it('reaches spl.ts and token.ts WITHOUT a rebuild — the whole reason this exists', () => {
    expect(xnftMintAddress()).toBe('')
    expect(isTokenLaunched()).toBe(false)

    __setRuntimeConfigForTests(armed)

    // No module was re-imported and nothing was rebuilt. If these still read ''
    // then something captured the value at import time and the change is inert.
    expect(xnftMintAddress()).toBe(MINT)
    expect(devWalletAddress()).toBe(WALLET)
    expect(treasuryAddress()).toBe(WALLET)
    expect(xnftCa()).toBe(MINT)
    expect(isTokenLaunched()).toBe(true)
    expect(isMintConfigured()).toBe(true)
  })

  it('follows a SECOND change, not just the first', () => {
    __setRuntimeConfigForTests(armed)
    expect(xnftMintAddress()).toBe(MINT)

    const rotated = 'XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp'
    __setRuntimeConfigForTests({ xnftMint: rotated })
    expect(xnftMintAddress()).toBe(rotated)
  })

  it('notifies subscribers so React can re-render on an operator edit', () => {
    let calls = 0
    const stop = subscribeRuntimeConfig(() => calls++)
    __setRuntimeConfigForTests(armed)
    __setRuntimeConfigForTests({ mintingEnabled: false })
    stop()
    __setRuntimeConfigForTests({ mintingEnabled: true })

    expect(calls).toBe(2)
  })
})

describe('disarming — every way a mint must refuse', () => {
  it('refuses while the config has not loaded, even if addresses look present', () => {
    // The dangerous case: default-shaped state that happens to carry addresses.
    // `loaded` is what separates "configured" from "not asked yet".
    __setRuntimeConfigForTests({ ...armed, loaded: false })
    expect(isMintArmed()).toBe(false)
    expect(isMintConfigured()).toBe(false)
  })

  it('refuses with no mint address', () => {
    __setRuntimeConfigForTests({ ...armed, xnftMint: '' })
    expect(isMintArmed()).toBe(false)
    expect(isMintConfigured()).toBe(false)
  })

  it('refuses with no project wallet — there is no safe default payee', () => {
    __setRuntimeConfigForTests({ ...armed, devWallet: '' })
    expect(isMintArmed()).toBe(false)
    expect(isMintConfigured()).toBe(false)
  })

  it('honours the operator kill switch without losing the address', () => {
    __setRuntimeConfigForTests({ ...armed, mintingEnabled: false })
    expect(isMintArmed()).toBe(false)
    expect(isMintConfigured()).toBe(false)
    // The address survives, which is the point of having a switch: stopping the
    // mint must not require destroying the configuration to do it.
    expect(xnftMintAddress()).toBe(MINT)
  })

  it('refuses on a malformed address rather than transferring to garbage', () => {
    __setRuntimeConfigForTests({ ...armed, xnftMint: 'not-a-real-base58-address!!' })
    // isMintArmed only checks non-empty; spl.ts additionally parses. Both must
    // agree that this is unusable, or a typo in the Supabase row becomes a
    // transaction pointed at nothing.
    expect(isMintConfigured()).toBe(false)
  })

  it('refuses on a mint that parses but a wallet that does not', () => {
    __setRuntimeConfigForTests({ ...armed, devWallet: 'oops' })
    expect(isMintConfigured()).toBe(false)
  })
})
