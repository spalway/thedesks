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

function banner() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
  <rect width="1500" height="500" fill="${PAPER}"/>

  <!-- The wordmark sits well right of centre-left: X overlays the avatar at the
       bottom-left of a header, and anything under roughly x=300 is covered. -->
  ${wordmark(300, 248, 100)}

  <text x="304" y="304" font-family="Segoe UI, Arial, sans-serif" font-size="27"
        font-weight="700" letter-spacing="2.4" fill="${INK}">POWERED BY XSTOCKS</text>

  <text x="304" y="346" font-family="Segoe UI, Arial, sans-serif" font-size="23" fill="${MUTE}">
    You don't buy a token. You hire an employee.
  </text>

  <!-- Vertical rule then the tape, echoing the header divider on the site. -->
  <rect x="1010" y="150" width="2" height="200" fill="${INK}" opacity="0.18"/>

  ${tape(1070, 178, 'NVDAx', '205.76', 1.84)}
  ${tape(1070, 226, 'AAPLx', '302.61', 0.42)}
  ${tape(1070, 274, 'MSFTx', '481.07', -0.63)}
  ${tape(1070, 322, 'SPYx', '771.84', 0.16)}

  ${rarityStrip(0, 488, 1500, 12)}
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

console.log(`banner  1500x500  ${(b / 1024).toFixed(1)} kB  -> public/brand/x-banner.png`)
console.log(`avatar   400x400  ${(a / 1024).toFixed(1)} kB  -> public/brand/x-avatar.png`)
console.log(`sources                             -> public/brand/*.svg`)
