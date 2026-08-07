// Base58 (Bitcoin alphabet), the encoding Solana uses for pubkeys and signatures.
//
// Hand-rolled rather than pulled from npm so that ingest-signature — the hottest
// and most security-relevant path — has no third-party code between a request
// body and a database row. It is forty lines of base conversion; the dependency
// surface is not worth it.
//
// Decode only. The encoder that used to live here existed to turn 32-byte Borsh
// pubkey fields back into addresses while decoding Anchor events; there are no
// events any more, and every address these functions handle arrives as base58
// already — from a request body, from an environment variable, or from the RPC's
// own `jsonParsed` output. What is left is validation.

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const INDEX: Record<string, number> = {}
for (let i = 0; i < ALPHABET.length; i++) INDEX[ALPHABET[i]] = i

/** Returns null on any character outside the alphabet, rather than throwing. */
export function decodeBase58(value: string): Uint8Array | null {
  if (value.length === 0) return null

  let zeros = 0
  while (zeros < value.length && value[zeros] === '1') zeros++

  const bytes: number[] = []
  for (let i = zeros; i < value.length; i++) {
    const digit = INDEX[value[i]]
    if (digit === undefined) return null
    let carry = digit
    for (let j = 0; j < bytes.length; j++) {
      const x = bytes[j] * 58 + carry
      bytes[j] = x & 0xff
      carry = x >> 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  const out = new Uint8Array(zeros + bytes.length)
  for (let i = 0; i < bytes.length; i++) out[zeros + bytes.length - 1 - i] = bytes[i]
  return out
}

/**
 * A pubkey is exactly 32 bytes. Worth checking the decoded length rather than the
 * string length: a 44-character base58 string can decode to 33 bytes, so a charset
 * regex alone accepts addresses that are not addresses.
 */
export function isValidAddress(value: string): boolean {
  const decoded = decodeBase58(value)
  return decoded !== null && decoded.length === 32
}

/** A signature is exactly 64 bytes. */
export function isValidSignature(value: string): boolean {
  const decoded = decodeBase58(value)
  return decoded !== null && decoded.length === 64
}
