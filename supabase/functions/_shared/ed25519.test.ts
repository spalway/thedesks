// Tests for the wallet half of the identity link.
//
// This is the only cryptography this backend performs itself — everything else it
// verifies, it verifies by asking the chain what happened. There is no chain
// reading for "this wallet and this X account are the same person", so the proof
// has to be constructed and checked, and a verifier that is wrong here writes an
// unverified link that every leaderboard then treats as fact.
//
// The cases that matter are the NEGATIVE ones. A verifier that accepts a real
// signature is easy; a verifier that also accepts a signature over a different
// message, or by a different key, is the failure worth testing for, and it is
// invisible in the happy path.
//
// Real keys throughout. `crypto.subtle` generates an ed25519 pair and signs with
// it, so these exercise the same code path the Deno runtime takes rather than a
// stub that agrees with the implementation by construction.
import { describe, expect, it } from 'vitest'

import { freshNonce, linkStatement, verifyWalletSignature } from './ed25519.ts'
import { isFnError } from './http.ts'

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/** Base58 encode, for turning generated keys into the form an address takes. */
function encodeBase58(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++

  const digits: number[] = []
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i]
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry
      digits[j] = x % 58
      carry = (x / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }

  let out = '1'.repeat(zeros)
  for (let i = digits.length - 1; i >= 0; i--) out += B58[digits[i]]
  return out
}

interface Wallet {
  address: string
  sign: (message: string) => Promise<string>
}

async function newWallet(): Promise<Wallet> {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return {
    address: encodeBase58(raw),
    sign: async (message: string) => {
      const signature = new Uint8Array(
        await crypto.subtle.sign({ name: 'Ed25519' }, pair.privateKey, new TextEncoder().encode(message)),
      )
      return encodeBase58(signature)
    },
  }
}

describe('the statement a wallet is asked to sign', () => {
  const statement = linkStatement({
    wallet: 'So11111111111111111111111111111111111111112',
    twitterHandle: 'skiz',
    nonce: 'abc123',
    issuedAt: '2026-08-05T12:00:00.000Z',
  })

  it('names every field that matters to the decision, in plain language', () => {
    // A wallet popup showing opaque bytes teaches users to approve opaque bytes,
    // which is the habit every drainer relies on.
    expect(statement).toContain('So11111111111111111111111111111111111111112')
    expect(statement).toContain('@skiz')
    expect(statement).toContain('abc123')
    expect(statement).toContain('2026-08-05T12:00:00.000Z')
  })

  it('says out loud that it moves nothing', () => {
    expect(statement).toContain('authorises no transfer')
  })

  it('changes when any field changes, so one signature cannot cover two links', () => {
    const other = linkStatement({
      wallet: 'So11111111111111111111111111111111111111112',
      twitterHandle: 'someone_else',
      nonce: 'abc123',
      issuedAt: '2026-08-05T12:00:00.000Z',
    })
    expect(other).not.toBe(statement)
  })
})

describe('nonces', () => {
  it("are 64 hex characters, inside the column's 32..128 bound", () => {
    const nonce = freshNonce()
    expect(nonce).toMatch(/^[0-9a-f]{64}$/)
  })

  it('do not repeat', () => {
    const seen = new Set(Array.from({ length: 500 }, () => freshNonce()))
    expect(seen.size).toBe(500)
  })
})

describe('verifying a wallet signature', () => {
  it('accepts a real signature by the real key over the real statement', async () => {
    const wallet = await newWallet()
    const statement = linkStatement({
      wallet: wallet.address,
      twitterHandle: 'skiz',
      nonce: freshNonce(),
      issuedAt: new Date().toISOString(),
    })
    const signature = await wallet.sign(statement)

    expect(await verifyWalletSignature(wallet.address, statement, signature)).toBe(true)
  })

  it('refuses a signature over a DIFFERENT message', async () => {
    // The replay case. A signature collected somewhere else — a phishing page,
    // another dapp asking the user to "verify ownership" — must not link a wallet
    // here, and the only thing standing between the two is that the message
    // differs.
    const wallet = await newWallet()
    const signature = await wallet.sign('some other thing this wallet signed once')

    expect(await verifyWalletSignature(wallet.address, 'the statement we issued', signature)).toBe(false)
  })

  it('refuses a signature by a different wallet', async () => {
    const mine = await newWallet()
    const theirs = await newWallet()
    const statement = 'xNFTs — link this wallet to an X account.'
    const signature = await theirs.sign(statement)

    // Someone signing the right words with the wrong key. This is the attack
    // where an attacker attaches a stranger's wallet to their own X account.
    expect(await verifyWalletSignature(mine.address, statement, signature)).toBe(false)
  })

  it('refuses a signature with a single bit flipped', async () => {
    const wallet = await newWallet()
    const statement = 'a statement'
    const signature = await wallet.sign(statement)

    // Flip the last base58 character to something else in the alphabet. The
    // decoded bytes change, so this is a well-formed 64-byte signature that
    // simply is not the right one.
    const last = signature[signature.length - 1]
    const swapped = B58[(B58.indexOf(last) + 1) % B58.length]
    const tampered = signature.slice(0, -1) + swapped

    const result = await verifyWalletSignature(wallet.address, statement, tampered)
    // Either a clean false, or a typed refusal if the tampering changed the
    // decoded length. Never true, which is the only thing that matters.
    expect(result === true).toBe(false)
  })

  it('refuses an address that is not 32 bytes, with a typed error rather than false', async () => {
    // The distinction is deliberate: a malformed input is "try again with a real
    // address", a valid-but-wrong signature is "that is not your wallet", and the
    // two lead a user somewhere different.
    const result = await verifyWalletSignature('not-an-address', 'msg', '11111111')
    expect(isFnError(result)).toBe(true)
  })

  it('refuses a signature that is not 64 bytes', async () => {
    const wallet = await newWallet()
    const result = await verifyWalletSignature(wallet.address, 'msg', '1111')
    expect(isFnError(result)).toBe(true)
  })

  it('never returns true for empty input', async () => {
    expect(await verifyWalletSignature('', '', '')).not.toBe(true)
  })
})
