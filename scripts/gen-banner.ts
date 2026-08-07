// The X header: xployees -> the business -> money. No text.
//
//   npx vite-node scripts/gen-banner.ts
//
// A diagram, not a portrait row. The row showed what the product looks like and
// said nothing about what it does; this states the whole pitch in one line —
// workers go in, the firm runs, money comes out — without a word of copy.
//
// Portraits are rendered through the same generator the site uses and the same
// rasteriser scripts/export-art.mjs uses, so they are real members of the
// collection. Everything else is pixel art drawn on the same grid discipline.
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

type RGB = [number, number, number]

const INK: RGB = [0, 0, 0]
const PAPER: RGB = [255, 255, 255]
const STEEL: RGB = [0xc8, 0xcc, 0xd6]
const STEEL_DK: RGB = [0x6d, 0x73, 0x82]
const MONEY: RGB = [0x3d, 0xdc, 0x84]
const MONEY_DK: RGB = [0x1f, 0x8f, 0x52]
const ARROW: RGB = [0x8e, 0x8e, 0x96]

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

function blit(src: Uint8Array, s: number, dx: number, dy: number) {
  for (let y = 0; y < s; y++) {
    const ty = dy + y
    if (ty < 0 || ty >= H) continue
    for (let x = 0; x < s; x++) {
      const tx = dx + x
      if (tx < 0 || tx >= W) continue
      const si = (y * s + x) * 3
      const ti = (ty * W + tx) * 3
      canvas[ti] = src[si]
      canvas[ti + 1] = src[si + 1]
      canvas[ti + 2] = src[si + 2]
    }
  }
}

/** Stamp an ASCII grid at a unit scale. Keys map a character to a colour. */
function stamp(rows: string[], ox: number, oy: number, u: number, keys: Record<string, RGB>) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = keys[row[x]]
      if (!c) continue
      rect(ox + x * u, oy + y * u, u, u, c)
    }
  })
}

// ---------------------------------------------------------------------------
// pieces
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

/**
 * An arrow, drawn rather than stamped so the shaft length is a parameter.
 *
 * The head is built from rows of decreasing height around the centre line,
 * which keeps every edge on the pixel grid — a rotated or anti-aliased
 * triangle would be the one soft thing in an otherwise hard-edged image.
 */
function arrow(x0: number, cy: number, len: number, u: number, c: RGB) {
  const shaftH = 2 * u
  const headLen = 5 * u
  rect(x0, cy - shaftH / 2, len - headLen, shaftH, c)
  for (let i = 0; i < 5; i++) {
    const h = (10 - i * 2) * u
    rect(x0 + len - headLen + i * u, cy - h / 2, u, h, c)
  }
}

/**
 * The business: an office block with lit windows.
 *
 * Windows are green rather than the usual warm yellow — the diagram's whole
 * claim is that this is where the money is made, and reusing the money colour
 * ties the middle of the sentence to its end.
 */
function building(ox: number, oy: number, u: number) {
  const BW = 17
  const BH = 21

  // antenna and roof
  rect(ox + 8 * u, oy, u, 3 * u, STEEL_DK)
  rect(ox + 1 * u, oy + 3 * u, (BW - 2) * u, u, STEEL_DK)
  // body
  rect(ox + 2 * u, oy + 4 * u, (BW - 4) * u, (BH - 4) * u, STEEL)
  // window grid — three columns of pairs, skipping the doorway rows
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      rect(ox + (3 + col * 3) * u, oy + (6 + row * 3) * u, 2 * u, 2 * u, MONEY)
    }
  }
  // doorway
  rect(ox + 7 * u, oy + (BH - 4) * u, 3 * u, 4 * u, STEEL_DK)
  rect(ox + 8 * u, oy + (BH - 3) * u, u, 3 * u, MONEY_DK)
  // ground line, so it reads as standing rather than floating
  rect(ox - u, oy + BH * u, (BW + 2) * u, u, STEEL_DK)
}

/** A dollar sign, authored as pixels so it matches everything else. */
const DOLLAR = [
  '.....##.....',
  '.....##.....',
  '..########..',
  '.##########.',
  '###..##..###',
  '###..##.....',
  '.###.##.....',
  '..########..',
  '....######..',
  '.......####.',
  '.....##..###',
  '.....##..###',
  '###..##..###',
  '.##########.',
  '..########..',
  '.....##.....',
  '.....##.....',
]

// ---------------------------------------------------------------------------
// compose
// ---------------------------------------------------------------------------

const images = decodeScenes()
const crew = collection()
const byTier = (t: string) => crew.filter((x) => x.tier.id === t)

/**
 * Six workers for the cluster, spanning every tier.
 *
 * The cluster is the subject of the sentence, so it has to read as "a workforce"
 * rather than "some pictures" — a mix of rarities does that where six of one
 * would not.
 */
const cluster = [
  byTier('xrated')[0],
  byTier('mid')[0],
  byTier('expert')[0],
  byTier('entry')[0],
  byTier('expert')[1],
  byTier('xrated')[1],
].filter(Boolean)

const TILE = 104
const GAP = 12
const STROKE = 3
const COLS = 3
const ROWS = 2

const clusterW = COLS * TILE + (COLS - 1) * GAP
const clusterH = ROWS * TILE + (ROWS - 1) * GAP

const U = 9 // pixel unit for the drawn pieces
const buildingW = 17 * U
const buildingH = 22 * U
const dollarW = DOLLAR[0].length * U
const arrowLen = 108
const SPACE = 54

const totalW = clusterW + SPACE + arrowLen + SPACE + buildingW + SPACE + arrowLen + SPACE + dollarW
let x = Math.round((W - totalW) / 2)
const cy = Math.round(H / 2)

// 1 — the workforce
const clusterTop = cy - Math.round(clusterH / 2)
cluster.forEach((xp, i) => {
  const col = i % COLS
  const row = Math.floor(i / COLS)
  const dx = x + col * (TILE + GAP)
  const dy = clusterTop + row * (TILE + GAP)
  rect(dx - STROKE, dy - STROKE, TILE + STROKE * 2, TILE + STROKE * 2, hex(xp.tier.color))
  blit(portrait(xp, TILE, images), TILE, dx, dy)
})
x += clusterW + SPACE

// 2 — in
arrow(x, cy, arrowLen, 4, ARROW)
x += arrowLen + SPACE

// 3 — the business
building(x, cy - Math.round(buildingH / 2), U)
x += buildingW + SPACE

// 4 — out
arrow(x, cy, arrowLen, 4, ARROW)
x += arrowLen + SPACE

// 5 — the money
stamp(DOLLAR, x, cy - Math.round((DOLLAR.length * U) / 2), U, { '#': MONEY })

const png = encodePng({ width: W, height: H, rgb: canvas })
writeFileSync(join(ROOT, 'public', 'brand', 'x-banner.png'), png)

console.log(`banner ${W}x${H}  ${(png.length / 1024).toFixed(1)} kB  -> public/brand/x-banner.png`)
console.log('cluster: ' + cluster.map((c) => `#${String(c.id).padStart(4, '0')} ${c.tier.label}`).join('  '))
void PAPER
