// symbol -> 16x16 pixel monogram tile.
//
// We cannot redraw real corporate logos — they are trademarks and we have no
// licence — so every tile here is an original mark: the company's initial(s)
// set in a hand-authored 5x7 pixel font over a brand-adjacent ground, plus a
// small motif. The motif is what keeps two tickers that share an initial
// apart: MSFTx and MSTRx both read "MS", and only the grid/chip mark and the
// blue/orange grounds tell them apart at 16px.
//
// Pure, and deliberately table-driven — no RNG anywhere. Hashing a symbol into
// a hue would be shorter and would give Coca-Cola a random teal.

export type Motif = 'plain' | 'bars' | 'chip' | 'dot' | 'slash' | 'ring' | 'grid'

export interface LogoSpec {
  /** Tile ground. */
  bg: string
  /** Monogram and motif ink. */
  fg: string
  /** 1–2 characters, drawn from FONT. */
  glyph: string
  motif: Motif
}

export const LOGO_GRID = 16

// ---------------------------------------------------------------------------
// 5x7 pixel font
// ---------------------------------------------------------------------------
//
// Hand-authored so each letter stays legible inside a 16px tile: 5 wide, 7
// tall, one clear pixel of counter in every enclosed shape. Wider "true" forms
// (a two-storey G, a tailed Q) get simplified rather than crammed — at this
// size a crammed glyph turns into a blob.

const FONT_W = 5
const FONT_H = 7

const FONT: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
}

// ---------------------------------------------------------------------------
// brand table
// ---------------------------------------------------------------------------
//
// Colours are brand-adjacent, not brand-exact: close enough that KOx reads as
// Coca-Cola red at a glance, far enough that nothing here is a lifted asset.
// The three reds (HONx / LLYx / KOx) are pulled apart on purpose — an orange
// red, a crimson and a pillarbox red — because at 16px a shared hue plus a
// shared tile shape is indistinguishable.

const LOGOS: Record<string, LogoSpec> = {
  NVDAx: { bg: '#76b900', fg: '#0b1500', glyph: 'NV', motif: 'chip' },
  AAPLx: { bg: '#1d1d1f', fg: '#f5f5f7', glyph: 'A', motif: 'dot' },
  MSFTx: { bg: '#0067b8', fg: '#ffffff', glyph: 'MS', motif: 'grid' },
  JPMx: { bg: '#1a2b5c', fg: '#ffffff', glyph: 'JP', motif: 'bars' },
  Vx: { bg: '#1a1f71', fg: '#f7b600', glyph: 'V', motif: 'slash' },
  XOMx: { bg: '#0c479d', fg: '#ffffff', glyph: 'XM', motif: 'slash' },
  HONx: { bg: '#e2231a', fg: '#ffffff', glyph: 'H', motif: 'plain' },
  LLYx: { bg: '#c8102e', fg: '#ffffff', glyph: 'LY', motif: 'plain' },
  UNHx: { bg: '#002677', fg: '#ffffff', glyph: 'UH', motif: 'bars' },
  KOx: { bg: '#f40009', fg: '#ffffff', glyph: 'KO', motif: 'slash' },
  PGx: { bg: '#003da5', fg: '#ffffff', glyph: 'PG', motif: 'ring' },
  SPYx: { bg: '#263047', fg: '#ffffff', glyph: 'SP', motif: 'bars' },
  TBLLx: { bg: '#1b4d3e', fg: '#e8f3ec', glyph: 'TB', motif: 'plain' },
  // AU, not GL: the chemical symbol is the one monogram gold already owns.
  GLDx: { bg: '#b8860b', fg: '#2a1c00', glyph: 'AU', motif: 'dot' },
  COINx: { bg: '#0052ff', fg: '#ffffff', glyph: 'CB', motif: 'ring' },
  MSTRx: { bg: '#f7931a', fg: '#1a1200', glyph: 'MS', motif: 'chip' },
}

/** Neutral mark for a symbol not in the table — the tape must never blank. */
const FALLBACK: LogoSpec = { bg: '#000000', fg: '#ffffff', glyph: 'X', motif: 'plain' }

/**
 * Trim a glyph to something the font can actually draw. Table entries go
 * through this too, so an unknown character can never reach the renderer.
 */
function normaliseGlyph(raw: string): string {
  let out = ''
  for (const ch of raw.toUpperCase()) {
    if (!FONT[ch]) continue
    out += ch
    if (out.length === 2) break
  }
  return out || FALLBACK.glyph
}

export function logoFor(symbol: string): LogoSpec {
  const spec = LOGOS[symbol]
  if (spec) return { ...spec, glyph: normaliseGlyph(spec.glyph) }

  // Derive a mark rather than throwing: an xStock added to the registry ahead
  // of this table should still render, just without the brand colour.
  const stem = symbol.endsWith('x') ? symbol.slice(0, -1) : symbol
  return { ...FALLBACK, glyph: normaliseGlyph(stem) }
}

// ---------------------------------------------------------------------------
// raster
// ---------------------------------------------------------------------------

type Grid = (string | null)[][]

function set(grid: Grid, x: number, y: number, color: string): void {
  if (x < 0 || y < 0 || x >= LOGO_GRID || y >= LOGO_GRID) return
  grid[y][x] = color
}

function drawChar(grid: Grid, ch: string, ox: number, oy: number, scale: number, color: string): void {
  const rows = FONT[ch]
  if (!rows) return
  for (let y = 0; y < FONT_H; y++) {
    for (let x = 0; x < FONT_W; x++) {
      if (rows[y][x] !== '#') continue
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          set(grid, ox + x * scale + sx, oy + y * scale + sy, color)
        }
      }
    }
  }
}

/**
 * Motifs live strictly in the margin the monogram never touches — columns 0–1
 * and 13–15, plus rows 0 and 15. That is what lets any motif combine with
 * either layout (one big letter or two small ones) without overprinting it.
 */
function drawMotif(grid: Grid, motif: Motif, color: string): void {
  switch (motif) {
    case 'plain':
      return

    case 'bars': {
      // Crop marks: an L in the top-left and its mirror bottom-right.
      for (let i = 0; i < 5; i++) set(grid, i, 0, color)
      for (let i = 0; i < 3; i++) set(grid, 0, i, color)
      for (let i = 11; i < 16; i++) set(grid, i, 15, color)
      for (let i = 13; i < 16; i++) set(grid, 15, i, color)
      return
    }

    case 'chip': {
      // DIP legs down both edges — the silicon tell.
      for (const row of [3, 4, 7, 8, 11, 12]) {
        set(grid, 0, row, color)
        set(grid, 15, row, color)
      }
      return
    }

    case 'dot': {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          set(grid, 13 + dx, 1 + dy, color)
          set(grid, dx, 13 + dy, color)
        }
      }
      return
    }

    case 'slash': {
      for (let i = 0; i < 3; i++) {
        set(grid, 15 - i, i, color)
        set(grid, i, 15 - i, color)
      }
      return
    }

    case 'ring': {
      // A frame with the corners cut in, so it reads round rather than square.
      for (let i = 2; i <= 13; i++) {
        set(grid, i, 0, color)
        set(grid, i, 15, color)
        set(grid, 0, i, color)
        set(grid, 15, i, color)
      }
      set(grid, 1, 1, color)
      set(grid, 14, 1, color)
      set(grid, 1, 14, color)
      set(grid, 14, 14, color)
      return
    }

    case 'grid': {
      const corners: readonly [number, number][] = [
        [0, 0],
        [14, 0],
        [0, 14],
        [14, 14],
      ]
      for (const [ox, oy] of corners) {
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) set(grid, ox + dx, oy + dy, color)
        }
      }
      return
    }
  }
}

/**
 * LOGO_GRID x LOGO_GRID of colour strings, indexed [y][x] to match avatar.ts.
 *
 * The four extreme corner pixels come back `null`: knocking them out rounds the
 * tile just enough that a row of sixteen of these reads as a set of marks
 * rather than a row of colour swatches.
 */
export function buildLogo(symbol: string): (string | null)[][] {
  const spec = logoFor(symbol)
  const grid: Grid = Array.from({ length: LOGO_GRID }, () =>
    Array<string | null>(LOGO_GRID).fill(spec.bg),
  )

  if (spec.glyph.length >= 2) {
    // 5 + 1 gutter + 5 = 11 wide, sat on the optical centre line.
    drawChar(grid, spec.glyph[0], 2, 4, 1, spec.fg)
    drawChar(grid, spec.glyph[1], 8, 4, 1, spec.fg)
  } else {
    // A lone 5x7 letter is lost in a 16px tile, so it doubles to 10x14.
    drawChar(grid, spec.glyph[0], 3, 1, 2, spec.fg)
  }

  drawMotif(grid, spec.motif, spec.fg)

  grid[0][0] = null
  grid[0][LOGO_GRID - 1] = null
  grid[LOGO_GRID - 1][0] = null
  grid[LOGO_GRID - 1][LOGO_GRID - 1] = null

  return grid
}
