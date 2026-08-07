// The X header: a row of real xployee portraits, no text.
//
//   npx vite-node scripts/gen-banner.ts
//
// Renders through the same generator the site uses and the same rasteriser
// scripts/export-art.mjs uses, so these are actual members of the collection
// rather than illustrations of them. The previous banner was a hand-drawn scene;
// this shows the product.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
// @ts-expect-error — plain .mjs helper, no type declarations
import { encodePng } from './lib/png.mjs'
// @ts-expect-error — plain .mjs helper, no type declarations
import { paintBackground, blitAvatar } from './lib/paint.mjs'
import { buildAvatar } from '../src/lib/avatar'
import { backgroundFor } from '../src/lib/backgrounds'
import { collection } from '../src/lib/collection'
import type { Xployee } from '../src/lib/xployee'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const W = 1500
const H = 500

/** Portrait edge, in px. Seven of these plus gaps fills the width comfortably. */
const TILE = 180
const GAP = 22
/** Rarity stroke around each portrait, echoing the frames on the site. */
const STROKE = 4

/**
 * X-RATED backdrops are JPEGs recoloured at render time, so the rasteriser needs
 * the decoded pixels. Every other tier is pure CSS and needs nothing.
 */
function decodeScenes(): Map<string, { width: number; height: number; data: Uint8Array }> {
  const dir = join(ROOT, 'public', 'texture-files', 'xrated')
  const images = new Map()
  for (const file of readdirSync(dir).sort()) {
    if (!/\.jpe?g$/i.test(file)) continue
    const raw = jpeg.decode(readFileSync(join(dir, file)), { useTArray: true })
    images.set(`/texture-files/xrated/${file}`, raw)
  }
  return images
}

/**
 * Seven portraits spanning every tier.
 *
 * Ordered so the two X-RATED sit at the ends rather than adjacent: X crops a
 * header hard on narrow viewports, and putting the loudest tiles at the edges
 * means whichever side survives the crop still has one.
 */
function lineup(): Xployee[] {
  const crew = collection()
  const byTier = (t: string) => crew.filter((x) => x.tier.id === t)

  const xrated = byTier('xrated')
  const epic = byTier('expert')
  const rare = byTier('mid')
  const uncommon = byTier('entry')

  const picked = [
    xrated[0],
    rare[0],
    epic[0],
    uncommon[0],
    epic[1],
    rare[1],
    xrated[1],
  ].filter(Boolean)

  if (picked.length < 7) throw new Error(`lineup: only ${picked.length} portraits available`)
  return picked
}

/** Render one xployee into its own square RGB buffer. */
function portrait(x: Xployee, size: number, images: Map<string, unknown>): Uint8Array {
  const buf = new Uint8Array(size * size * 3)
  paintBackground(buf, size, backgroundFor(x), { cssSize: size, images })
  blitAvatar(buf, size, buildAvatar(x))
  return buf
}

/** Copy a square RGB buffer into the canvas at (dx, dy), clipping at the edges. */
function blit(canvas: Uint8Array, cw: number, ch: number, src: Uint8Array, s: number, dx: number, dy: number) {
  for (let y = 0; y < s; y++) {
    const ty = dy + y
    if (ty < 0 || ty >= ch) continue
    for (let x = 0; x < s; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= cw) continue
      const si = (y * s + x) * 3
      const ti = (ty * cw + tx) * 3
      canvas[ti] = src[si]
      canvas[ti + 1] = src[si + 1]
      canvas[ti + 2] = src[si + 2]
    }
  }
}

function fillRect(canvas: Uint8Array, cw: number, ch: number, x0: number, y0: number, w: number, h: number, rgb: [number, number, number]) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= ch) continue
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= cw) continue
      const i = (y * cw + x) * 3
      canvas[i] = rgb[0]
      canvas[i + 1] = rgb[1]
      canvas[i + 2] = rgb[2]
    }
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const images = decodeScenes()
const crew = lineup()

// White ground, matching the site's paper.
const canvas = new Uint8Array(W * H * 3).fill(255)

const total = crew.length * TILE + (crew.length - 1) * GAP
const startX = Math.round((W - total) / 2)
const y = Math.round((H - TILE) / 2)

crew.forEach((x, i) => {
  const dx = startX + i * (TILE + GAP)

  // Rarity stroke first, then the portrait inset into it — the same treatment
  // the site's frames give, where the art sits in the content box so the border
  // never crops the character.
  fillRect(canvas, W, H, dx - STROKE, y - STROKE, TILE + STROKE * 2, TILE + STROKE * 2, hexToRgb(x.tier.color))
  blit(canvas, W, H, portrait(x, TILE, images), TILE, dx, y)
})

const png = encodePng({ width: W, height: H, rgb: canvas })
writeFileSync(join(ROOT, 'public', 'brand', 'x-banner.png'), png)

console.log(`banner ${W}x${H}  ${(png.length / 1024).toFixed(1)} kB  -> public/brand/x-banner.png`)
console.log(
  'lineup: ' +
    crew.map((x) => `#${String(x.id).padStart(4, '0')} ${x.tier.label}`).join('  |  '),
)
