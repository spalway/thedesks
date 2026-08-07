// Node globals that @solana/web3.js and @solana/spl-token expect.
//
// Vite does not polyfill Node builtins, and spl-token touches `Buffer` at
// MODULE EVALUATION time — not just at call time. That is why this lives in its
// own module imported first from main.tsx: a module body runs before the bodies
// of anything imported after it, so Buffer exists by the time Solana loads.
// Assigning inside main.tsx instead would run too late and throw
// "Buffer is not defined" during import.
import { Buffer } from 'buffer'

declare global {
  interface Window {
    Buffer: typeof Buffer
    global: typeof globalThis
  }
}

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

// Some transitive deps still reference `global`.
if (typeof globalThis.global === 'undefined') {
  globalThis.global = globalThis
}

export {}
