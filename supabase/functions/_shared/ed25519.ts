// Proving a wallet signed something.
//
// This is the wallet half of the identity link, and it is the only cryptography
// this backend performs itself. Everything else it verifies — a mint, a rental, a
// payout — it verifies by asking the chain what happened. There is no chain
// reading for "this wallet is the same person as this X account", because nothing
// on chain has an opinion about it, so the proof has to be constructed and
// checked here.
//
// ---------------------------------------------------------------------------
// WHAT A SIGNATURE PROVES, AND WHAT IT DOES NOT
// ---------------------------------------------------------------------------
// Solana wallets sign arbitrary bytes with the account's ed25519 key — the same
// key that authorises transfers. A valid signature over a message proves the
// signer holds that key. It proves NOTHING about what they intended unless the
// message says so, which is why `link-wallet` composes a statement naming the
// action, the wallet, the X handle and the nonce, and why the statement is stored
// server-side and compared rather than rebuilt at verification time. A verifier
// that reconstructs the message from a template is a verifier that can be handed
// a signature made over a different template.
//
// The nonce is what makes it un-replayable, and it is issued by this server: a
// client-chosen nonce is a signature an attacker may have collected somewhere
// else — from a phishing page, from a different dapp asking the user to "verify
// ownership" — and presented here.
//
// ---------------------------------------------------------------------------
// FAILING CLOSED
// ---------------------------------------------------------------------------
// Ed25519 in WebCrypto is available in the Deno runtime these functions run on,
// but availability is a property of a runtime version rather than of this code.
// Every failure path below — algorithm unsupported, key the wrong length,
// signature malformed, verify throwing — returns FALSE or a typed error. There is
// no branch that treats "could not check" as "checked and fine", because that
// branch is how an unverified wallet link gets written.
import { decodeBase58 } from './base58.ts'
import { fnError, type FnError } from './http.ts'

const ED25519_PUBKEY_BYTES = 32
const ED25519_SIGNATURE_BYTES = 64

/**
 * Verifies `signature` over `message` under the base58 Solana address `address`.
 *
 * Returns an FnError only when the INPUTS are unusable or the runtime cannot do
 * the arithmetic. A well-formed input that simply does not verify returns
 * `false` — the two are different answers and a caller renders them differently:
 * one is "try again", the other is "that is not your wallet".
 */
export async function verifyWalletSignature(
  address: string,
  message: string,
  signatureBase58: string,
): Promise<boolean | FnError> {
  const publicKey = decodeBase58(address)
  if (publicKey === null || publicKey.length !== ED25519_PUBKEY_BYTES) {
    return fnError('bad-request', 'That is not a Solana address, so there is no key to check a signature against.')
  }

  const signature = decodeBase58(signatureBase58)
  if (signature === null || signature.length !== ED25519_SIGNATURE_BYTES) {
    return fnError('bad-request', 'That is not an ed25519 signature. Nothing was linked.')
  }

  const bytes = new TextEncoder().encode(message)

  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify'])
  } catch (e) {
    // The runtime cannot do ed25519. Refuse loudly rather than skip the check —
    // an environment that cannot verify a proof must not be allowed to write one.
    const detail = e instanceof Error ? e.message : 'unknown error'
    return fnError(
      'unknown',
      'This runtime cannot verify ed25519 signatures, so no wallet link can be proved. Nothing was written.',
      detail,
    )
  }

  try {
    return await crypto.subtle.verify({ name: 'Ed25519' }, key, signature, bytes)
  } catch {
    // A throw from verify is not a pass. Treated as a failed proof.
    return false
  }
}

/**
 * The exact text a wallet is asked to sign.
 *
 * Composed here so the issuing path and the record of it come from one function,
 * and written to be READ by the person signing it: a wallet popup showing opaque
 * bytes teaches users to approve opaque bytes, which is the habit every drainer
 * relies on. Every field that matters to the decision is named in plain language.
 */
export function linkStatement(params: {
  wallet: string
  twitterHandle: string
  nonce: string
  issuedAt: string
}): string {
  return [
    'xNFTs — link this wallet to an X account.',
    '',
    `Wallet:  ${params.wallet}`,
    `X:       @${params.twitterHandle}`,
    `Nonce:   ${params.nonce}`,
    `Issued:  ${params.issuedAt}`,
    '',
    'Signing this proves you hold this wallet. It authorises no transfer and moves no tokens.',
  ].join('\n')
}

/** 32 bytes of CSPRNG as lowercase hex — 64 characters, inside the nonce column's 32..128 bound. */
export function freshNonce(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
