// The X header: the crew in formation, rarest at the front.
//
//   npm run banner
//
// A staggered V on black. One X-RATED leads, two EPIC flank it, then RARE, then
// UNCOMMON — each rank a step further out, a step higher, a step smaller and a
// step darker. Those four cues together are what make it read as depth rather
// than as a row of differently-sized squares, and the order they run in is the
// rarity ladder, so the composition states the hierarchy without a word of copy.
//
// Portraits render through the same generator the site uses and the same
// rasteriser scripts/export-art.mjs uses, so they are real members of the
// collection rather than drawings of one.
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
import { showcase } from '../src/lib/collection'
import { serial, type Xployee } from '../src/lib/xployee'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const W = 1500
const H = 500

type RGB = [number, number, number]

const INK: RGB = [0, 0, 0]

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]

// ---------------------------------------------------------------------------
// canvas
// ---------------------------------------------------------------------------

const canvas = new Uint8Array(W * H * 3)
for (let i = 0; i < canvas.length; i += 3) {
  canvas[i] = INK[0]
  canvas[i + 1] = INK[1]
  canvas[i + 2] = INK[2]
}

function rect(x0: number, y0: number, w: number, h: number, c: RGB) {
  for (let y = y0; y < y0 + h; y++) {
    if (y < 0 || y >= H) continue
    for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || x >= W) continue
      const i = (y * W + x) * 3
      canvas[i] = c[0]
      canvas[i + 1] = c[1]
      canvas[i + 2] = c[2]
    }
  }
}

/**
 * Copy a portrait onto the canvas, optionally darkened.
 *
 * `dim` is the atmospheric cue. Smaller and higher alone read as "different
 * sizes"; losing a little light as they recede is what makes the back ranks sit
 * behind the front one rather than beside it. Kept shallow — at 0.7 the
 * UNCOMMONs stop reading as green.
 */
function blit(src: Uint8Array, s: number, dx: number, dy: number, dim = 1) {
  for (let y = 0; y < s; y++) {
    const ty = dy + y
    if (ty < 0 || ty >= H) continue
    for (let x = 0; x < s; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= W) continue
      const si = (y * s + x) * 3
      const ti = (ty * W + tx) * 3
      canvas[ti] = Math.round(src[si] * dim)
      canvas[ti + 1] = Math.round(src[si + 1] * dim)
      canvas[ti + 2] = Math.round(src[si + 2] * dim)
    }
  }
}

// ---------------------------------------------------------------------------
// portraits
// ---------------------------------------------------------------------------

function decodeScenes() {
  const dir = join(ROOT, 'public', 'texture-files', 'xrated')
  const images = new Map()
  for (const file of readdirSync(dir).sort()) {
    if (!/\.jpe?g$/i.test(file)) continue
    images.set(`/texture-files/xrated/${file}`, jpeg.decode(readFileSync(join(dir, file)), { useTArray: true }))
  }
  return images
}

function portrait(x: Xployee, size: number, images: Map<string, unknown>): Uint8Array {
  const buf = new Uint8Array(size * size * 3)
  paintBackground(buf, size, backgroundFor(x), { cssSize: size, images })
  blitAvatar(buf, size, buildAvatar(x))
  return buf
}

// ---------------------------------------------------------------------------
// the formation
// ---------------------------------------------------------------------------

const crew = showcase()
const pick = (tier: string, n: number) => crew.filter((x) => x.tier.id === tier)[n]

interface Placed {
  xployee: Xployee
  size: number
  /** Centre, so the ranks line up on their middles rather than their corners. */
  cx: number
  cy: number
  dim: number
  stroke: number
}

/**
 * Rank sizes, offsets and depth.
 *
 * `size` steps down about 15% a rank, which is enough to read as distance and
 * gentle enough that the UNCOMMONs at the back still show their faces — the
 * avatar is a 32-grid, so even the smallest here gives every pixel three
 * screen pixels.
 *
 * `out` is horizontal displacement from centre and `up` is vertical.
 *
 * Each `out` is deliberately SMALLER than the sum of the two neighbouring half
 * widths, so every rank is partly occluded by the one in front of it. That
 * overlap is what makes this a formation with a leader; spaced far enough apart
 * to clear each other — the first version of this file did exactly that — the
 * same seven portraits read as a row of separate pictures at slightly different
 * sizes, and the depth disappears no matter how they are dimmed.
 */
const RANKS: { tier: string; size: number; out: number; up: number; dim: number; stroke: number }[] = [
  { tier: 'entry', size: 104, out: 318, up: 132, dim: 0.74, stroke: 3 },
  { tier: 'mid', size: 122, out: 224, up: 88, dim: 0.84, stroke: 3 },
  { tier: 'expert', size: 144, out: 118, up: 42, dim: 0.93, stroke: 4 },
]

const LEAD_SIZE = 172

const placed: Placed[] = []

// Back to front, so the nearer rank always overlaps the one behind it. Drawing
// this the other way round is the whole difference between a formation and a
// pile of squares.
for (const rank of RANKS) {
  for (const side of [-1, 1]) {
    const xployee = pick(rank.tier, side < 0 ? 0 : 1)
    if (!xployee) continue
    placed.push({
      xployee,
      size: rank.size,
      cx: side * rank.out,
      cy: -rank.up,
      dim: rank.dim,
      stroke: rank.stroke,
    })
  }
}

const lead = pick('xrated', 0)
if (!lead) throw new Error('showcase() has no X-RATED — nothing can lead the formation')
placed.push({ xployee: lead, size: LEAD_SIZE, cx: 0, cy: 0, dim: 1, stroke: 5 })

// Centre the whole formation on the canvas rather than trusting the offsets to
// balance. The ranks rise but the lead does not, so the shape's own centre sits
// well above zero and hardcoding a y would leave it low in the frame.
let top = Infinity
let bottom = -Infinity
for (const p of placed) {
  top = Math.min(top, p.cy - p.size / 2 - p.stroke)
  bottom = Math.max(bottom, p.cy + p.size / 2 + p.stroke)
}
const originX = Math.round(W / 2)
const originY = Math.round(H / 2 - (top + bottom) / 2)

const images = decodeScenes()

for (const p of placed) {
  const size = p.size
  const dx = Math.round(originX + p.cx - size / 2)
  const dy = Math.round(originY + p.cy - size / 2)
  // The rarity stroke, dimmed with its rank so the frame recedes along with the
  // art it holds. A full-brightness border on a darkened portrait would read as
  // a bright ring floating in front of it.
  const border = hex(p.xployee.tier.color).map((v) => Math.round(v * p.dim)) as RGB
  rect(dx - p.stroke, dy - p.stroke, size + p.stroke * 2, size + p.stroke * 2, border)
  blit(portrait(p.xployee, size, images), size, dx, dy, p.dim)
}

const png = encodePng({ width: W, height: H, rgb: canvas })
writeFileSync(join(ROOT, 'public', 'brand', 'x-banner.png'), png)

console.log(`banner ${W}x${H}  ${(png.length / 1024).toFixed(1)} kB  -> public/brand/x-banner.png`)
for (const p of placed) {
  console.log(`  ${String(p.size).padStart(3)}px  ${serial(p.xployee.id)}  ${p.xployee.tier.label}`)
}
