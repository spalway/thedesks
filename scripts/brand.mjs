// Brand assets for X/Twitter: a 1500x500 header and a 400x400 avatar.
//
// Authored as SVG and rasterised with resvg rather than drawn by hand, so the
// two stay editable and can be re-rendered at any size. Both are built from the
// same tokens the site uses (index.css) — paper/ink, the four rarity hues, and
// the m42 wordmark — because a banner that invents its own palette stops
// reading as the same product the moment someone lands on the site.
//
//   npm run brand
import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'brand')
const M42 = join(ROOT, 'public', 'fonts', 'm42.ttf')

// index.css tokens. Kept as literals here on purpose: this script runs outside
// the bundle and cannot import CSS, so the duplication is unavoidable — but it
// is one place, and a drift is visible the moment the banner sits next to the
// site.
const INK = '#000000'
const PAPER = '#ffffff'
const T1 = '#44af63' // UNCOMMON
const T2 = '#1d84de' // RARE
const T3 = '#d211b0' // EPIC
const T4 = '#ff1b1b' // X-RATED
const UP = '#157f3a'
const DOWN = '#dc2626'
const MUTE = '#5f5f5f'

/**
 * The wordmark, faked the same way Layout.tsx fakes it.
 *
 * m42 is caps-only, so "xNFTs" is really "X" + "NFT" + "S" with the outer two
 * set smaller. Rendered as three positioned <text> runs rather than one string,
 * because a single run would set every glyph at one size and read as "XNFTS".
 */
function wordmark(x, y, big) {
  const small = Math.round(big * 0.57)
  // One <text> with three <tspan> runs, NOT three positioned <text> elements.
  // The first attempt placed each run by hand from an assumed 0.62em advance;
  // m42's real advances are wider, so the runs overlapped and "xNFTs" rendered
  // as a collided "xNET" with the S buried under the T. Letting the shaper
  // advance the pen is the only way to be right about a face's metrics without
  // measuring them.
  return `
    <text x="${x}" y="${y}" fill="${INK}" font-family="M42_FLIGHT 721" letter-spacing="${big * 0.03}">
      <tspan font-size="${small}">X</tspan><tspan font-size="${big}">NFT</tspan><tspan font-size="${small}">S</tspan>
    </text>`
}

/** One row of the market tape — ticker, price, signed delta. */
function tape(x, y, sym, price, delta) {
  const positive = delta >= 0
  const color = positive ? UP : DOWN
  const arrow = positive ? '▲' : '▼'
  return `
    <g font-family="Consolas, 'Courier New', monospace">
      <text x="${x}" y="${y}" font-size="26" fill="${INK}" font-weight="700">$${sym}</text>
      <text x="${x + 190}" y="${y}" font-size="26" fill="${INK}" text-anchor="end">$${price}</text>
      <text x="${x + 320}" y="${y}" font-size="24" fill="${color}" text-anchor="end">${arrow} ${Math.abs(delta).toFixed(2)}%</text>
    </g>`
}

/** The four rarity hues as a hard-edged strip — the site's one use of colour. */
function rarityStrip(x, y, w, h) {
  const seg = w / 4
  return [T1, T2, T3, T4]
    .map((c, i) => `<rect x="${x + i * seg}" y="${y}" width="${seg}" height="${h}" fill="${c}"/>`)
    .join('')
}

/**
 * An xployee at a desk, drawn in 2.5D from a raised angle.
 *
 * Pixel art built from rects rather than paths, at a fixed unit size, so edges
 * stay hard at any export scale — the same reason the site renders its avatars
 * on a canvas with image-rendering: pixelated.
 *
 * The projection is a simple oblique: every "depth" step moves right by DX and
 * up by DY. Not a true isometric (which would also foreshorten width), because
 * an oblique keeps every face on the pixel grid and a rotated one does not,
 * which is what stops the whole thing looking like a resized JPEG.
 */
function scene(canvasW, canvasH, margin) {
  // Collected in UNIT space and centred afterwards from measured bounds. Placing
  // it by hand meant recomputing an offset every time a rect moved, and the first
  // attempt cropped the desk legs off the bottom for exactly that reason.
  const cells = []
  const r = (x, y, w, h, fill) => cells.push({ x, y, w, h, fill })

  // Palette. Desk in warm neutrals, monitor near-black, one green for the money
  // — the same restraint the site uses: colour only where it means something.
  const DESK = '#c8b48f'
  const DESK_TOP = '#ddc9a4'
  const DESK_DARK = '#a08d6b'
  const SKIN = '#f0c9a0'
  const SKIN_DK = '#d3a77e'
  const HAIR = '#3b2a1e'
  const SHIRT = '#2b2f3d'
  const SHIRT_DK = '#1a1d27'
  const SCREEN = '#15131b'
  const SCREEN_LIT = '#1d2b24'
  const GREEN = '#3ddc84'
  const CHAIR = '#4a4a52'

  // ---- desk: top face, then the two visible sides ------------------------
  for (let i = 0; i < 9; i++) r(10 - i, 22 + i, 30, 1, i === 0 ? DESK_TOP : DESK)
  r(1, 31, 30, 2, DESK_DARK) // front edge
  r(1, 33, 2, 7, DESK_DARK) // left leg
  r(29, 33, 2, 7, DESK_DARK) // right leg

  // ---- monitor, angled back and to the right -----------------------------
  r(19, 8, 13, 9, SCREEN)
  r(20, 9, 11, 7, SCREEN_LIT)
  // A rising chart on the screen — the only motion the still image can imply.
  const bars = [2, 3, 2, 4, 5, 4, 6]
  bars.forEach((h, i) => r(21 + i, 15 - h + 1, 1, h, GREEN))
  r(24, 17, 3, 2, SCREEN) // stand
  r(23, 19, 5, 1, SCREEN) // foot

  // ---- the xployee, seen from behind and slightly above -------------------
  r(9, 17, 6, 5, HAIR) // hair
  r(10, 20, 4, 3, SKIN) // neck and jaw
  r(9, 22, 6, 1, SKIN_DK) // collar shadow
  r(8, 23, 8, 6, SHIRT) // torso
  r(8, 23, 8, 1, SHIRT_DK) // shoulder line
  r(7, 25, 1, 4, SHIRT_DK) // left arm
  r(16, 25, 1, 4, SHIRT_DK) // right arm
  r(16, 28, 2, 1, SKIN) // right hand, on the desk
  r(6, 28, 2, 1, SKIN) // left hand

  // ---- chair back --------------------------------------------------------
  r(7, 29, 10, 1, CHAIR)
  r(7, 30, 1, 4, CHAIR)
  r(16, 30, 1, 4, CHAIR)

  // ---- money on the desk -------------------------------------------------
  // Three notes stacked, and coins. Kept small: the joke is that the work is
  // boring and the output is not.
  for (let i = 0; i < 3; i++) {
    r(2 + i * 0.4, 26 - i * 0.6, 5, 2, i === 2 ? '#5fe89b' : GREEN)
    r(4 + i * 0.4, 26.5 - i * 0.6, 1, 1, '#0f7a44')
  }
  r(23, 23, 2, 2, '#e8c96a')
  r(25, 24, 2, 2, '#d8b34a')
  r(21, 25, 2, 2, '#e8c96a')

  // Measured bounds, then the largest whole-pixel unit that still fits inside
  // the margin. Whole units matter: a fractional one puts rect edges on
  // half-pixels and the hard pixel-art edges turn soft.
  const minX = Math.min(...cells.map((c) => c.x))
  const maxX = Math.max(...cells.map((c) => c.x + c.w))
  const minY = Math.min(...cells.map((c) => c.y))
  const maxY = Math.max(...cells.map((c) => c.y + c.h))
  const wUnits = maxX - minX
  const hUnits = maxY - minY

  const u = Math.floor(
    Math.min((canvasW - margin * 2) / wUnits, (canvasH - margin * 2) / hUnits),
  )
  const ox = Math.round((canvasW - wUnits * u) / 2 - minX * u)
  const oy = Math.round((canvasH - hUnits * u) / 2 - minY * u)

  return cells
    .map(
      (c) =>
        `<rect x="${ox + c.x * u}" y="${oy + c.y * u}" width="${c.w * u}" height="${c.h * u}" fill="${c.fill}"/>`,
    )
    .join('\n  ')
}

function banner() {
  // Nothing but the scene on white, per the brief. No wordmark, no tape, no
  // tagline — an X header is cropped hard on mobile and a single subject
  // survives that where a composition does not.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
  <rect width="1500" height="500" fill="${PAPER}"/>
  ${scene(1500, 500, 48)}
</svg>`
}

function avatar() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="${INK}"/>

  <!-- X-RATED red, the rarest tier's hue, as the frame. It is the one colour in
       the system that reads at 48px in a timeline. -->
  <rect x="0" y="0" width="400" height="400" fill="none" stroke="${T4}" stroke-width="20"/>

  <!-- Sized and placed so the glyph plus its bar centre as ONE block. At 210 the
       X very nearly touched the frame and the pair sat high, leaving a dead
       band along the bottom that reads as a cropping mistake at avatar size. -->
  <text x="200" y="278" font-family="M42_FLIGHT 721" font-size="180" fill="${PAPER}"
        text-anchor="middle">X</text>

  <!-- The laser bar. Same gesture as the X-RATED frame animation on the site,
       held at its bright end because a still image cannot breathe. -->
  <rect x="130" y="298" width="140" height="10" fill="${T4}"/>
</svg>`
}

/**
 * The favicon: a white pixel X on ink.
 *
 * Drawn as rects on an explicit grid rather than set in m42, because an SVG
 * favicon is rendered in an isolated context that does not load @font-face —
 * the glyph would silently fall back to a system face and stop being pixel art.
 *
 * Black ground, not white. A white X needs something to sit on, and ink is the
 * brand's other half; on white it would be an empty square in the tab.
 *
 * GRID is odd so the two diagonals cross on a single centre cell instead of
 * meeting in a 2x2 blur, which is what keeps the join sharp at 16px.
 */
function faviconSvg(size) {
  const GRID = 11
  const cell = size / GRID
  const px = []

  // Membership by distance from each diagonal, rather than by plotting offset
  // cells. The offset version had to clamp at the edges, and clamping collapsed
  // two cells into one — so the bottom row came out one pixel thinner than the
  // top and the X sat visibly crooked. A predicate has no edges to special-case.
  //
  // <= 1 gives arms two cells wide. One is too fine to survive a 16px tab;
  // three closes the counters and reads as a filled square.
  const onArm = (x, y) => Math.abs(x - y) <= 1 || Math.abs(x + y - (GRID - 1)) <= 1

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!onArm(x, y)) continue
      px.push(`<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`)
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="${INK}"/>
  <g fill="${PAPER}">
    ${px.join('\n    ')}
  </g>
</svg>`
}

function render(svg, width, file) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [M42], loadSystemFonts: true, defaultFontFamily: 'Segoe UI' },
    // m42 is a bitmap face; smoothing its edges defeats the whole point.
    shapeRendering: 2,
    imageRendering: 1,
  })
  const png = r.render().asPng()
  writeFileSync(file, png)
  return png.length
}

mkdirSync(OUT, { recursive: true })
const b = render(banner(), 1500, join(OUT, 'x-banner.png'))
const a = render(avatar(), 400, join(OUT, 'x-avatar.png'))
writeFileSync(join(OUT, 'x-banner.svg'), banner())
writeFileSync(join(OUT, 'x-avatar.svg'), avatar())

// Favicon goes to public/ root, not public/brand/ — index.html references it by
// a stable path and a tab icon is not a brand deliverable to hand someone.
const PUBLIC = join(ROOT, 'public')
const favSvg = faviconSvg(64)
writeFileSync(join(PUBLIC, 'favicon.svg'), favSvg)
// PNG fallbacks: Safari ignores SVG favicons, and the 180px one is what iOS
// uses for a home-screen bookmark.
const f32 = render(favSvg, 32, join(PUBLIC, 'favicon-32.png'))
const f180 = render(favSvg, 180, join(PUBLIC, 'apple-touch-icon.png'))

console.log(`banner  1500x500  ${(b / 1024).toFixed(1)} kB  -> public/brand/x-banner.png`)
console.log(`avatar   400x400  ${(a / 1024).toFixed(1)} kB  -> public/brand/x-avatar.png`)
console.log(`favicon    64/svg  ${(favSvg.length / 1024).toFixed(1)} kB  -> public/favicon.svg`)
console.log(`favicon    32x32  ${(f32 / 1024).toFixed(1)} kB  -> public/favicon-32.png`)
console.log(`apple     180x180  ${(f180 / 1024).toFixed(1)} kB  -> public/apple-touch-icon.png`)
console.log(`sources                             -> public/brand/*.svg`)
