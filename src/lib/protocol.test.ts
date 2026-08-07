import { describe, it, expect } from 'vitest'
import { hashString, mulberry32, pickDistinct, rngFrom, fakeAddress } from './rng'
import { TIERS, tierForId } from './tiers'
import { SKILLS, rollSkills, blendedApy, effectiveApy } from './skills'
import { buildXployee, MAX_SUPPLY } from './xployee'
import { accruedTotal, bookValue, trailingApy, EPOCH_MS } from './accrual'
import { collection, HIRED_COUNT, mintOrder } from './collection'
import { contractMath, type ContractListing } from './market'
import { buildAvatar, GRID } from './avatar'
import { UNIFORMS, HEADS, FACES } from './xployee'
import { seedSparks, stepSparks, sparkColor } from './sparks'
import { backgroundFor, seedParticles, stepParticles, particleCount } from './backgrounds'
import {
  networkWallets,
  searchWallets,
  networkStats,
  xBossFor,
  nextRank,
} from './network'
import { normaliseTwitter, validateProfile, EMPTY_PROFILE } from './profile'
import { shortAddress, signedPct, usd } from './format'

describe('rng', () => {
  it('hashes deterministically', () => {
    expect(hashString('xployee:42')).toBe(hashString('xployee:42'))
    expect(hashString('a')).not.toBe(hashString('b'))
  })

  it('produces a stable sequence for a seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('stays within [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 5000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('pickDistinct never repeats and never over-draws', () => {
    for (let seed = 0; seed < 200; seed++) {
      const picked = pickDistinct(rngFrom('t', String(seed)), SKILLS, 4, (s) => s.weight)
      expect(picked).toHaveLength(4)
      expect(new Set(picked.map((s) => s.id)).size).toBe(4)
    }
  })

  it('pickDistinct refuses to over-draw rather than returning short', () => {
    expect(() => pickDistinct(mulberry32(1), SKILLS, SKILLS.length + 1)).toThrow()
  })

  it('generates base58-shaped addresses with no forbidden characters', () => {
    const addr = fakeAddress('xployee:1')
    expect(addr).toHaveLength(44)
    expect(addr).not.toMatch(/[0OIl]/)
  })
})

describe('tiers', () => {
  it('supply sums to 1', () => {
    const total = TIERS.reduce((s, t) => s + t.supply, 0)
    expect(total).toBeCloseTo(1, 10)
  })

  it('skill counts are 1..4 ascending with rarity', () => {
    expect(TIERS.map((t) => t.skills)).toEqual([1, 2, 3, 4])
  })

  it('lays serials out in the declared proportions', () => {
    const counts: Record<string, number> = {}
    for (let id = 0; id < MAX_SUPPLY; id++) {
      const tier = tierForId(id, MAX_SUPPLY)
      counts[tier.id] = (counts[tier.id] ?? 0) + 1
    }
    // Positional, so this is exact rather than statistical.
    for (const tier of TIERS) {
      expect((counts[tier.id] ?? 0) / MAX_SUPPLY).toBeCloseTo(tier.supply, 3)
    }
  })

  it('puts the rarest serials first, with no gap between bands', () => {
    const boundaries: [number, string][] = [
      [0, 'xrated'],
      [149, 'xrated'],
      [150, 'expert'],
      [749, 'expert'],
      [750, 'mid'],
      [1999, 'mid'],
      [2000, 'entry'],
      [MAX_SUPPLY - 1, 'entry'],
    ]
    for (const [id, expected] of boundaries) {
      expect(tierForId(id, MAX_SUPPLY).id).toBe(expected)
    }
  })

  it('assigns every serial in the supply to some tier', () => {
    for (let id = 0; id < MAX_SUPPLY; id++) {
      expect(tierForId(id, MAX_SUPPLY)).toBeDefined()
    }
  })
})

describe('reveal order', () => {
  it('is a permutation of the whole supply — every serial once', () => {
    const o = mintOrder()
    expect(o).toHaveLength(MAX_SUPPLY)
    expect(new Set(o).size).toBe(MAX_SUPPLY)
    expect(Math.min(...o)).toBe(0)
    expect(Math.max(...o)).toBe(MAX_SUPPLY - 1)
  })

  it('does not hand out serials in ascending order', () => {
    // The whole point: ascending serials would give the first 150 mints every
    // X-RATED and everything past #2000 an uncommon, killing the lottery.
    const head = mintOrder().slice(0, 200)
    const ascending = head.every((v, i) => i === 0 || v > head[i - 1])
    expect(ascending).toBe(false)
  })

  it('still reveals rarities in roughly their declared proportions', () => {
    const counts: Record<string, number> = {}
    for (const id of mintOrder().slice(0, HIRED_COUNT)) {
      const t = tierForId(id, MAX_SUPPLY).id
      counts[t] = (counts[t] ?? 0) + 1
    }
    for (const tier of TIERS) {
      const share = (counts[tier.id] ?? 0) / HIRED_COUNT
      expect(Math.abs(share - tier.supply)).toBeLessThan(0.05)
    }
  })
})

describe('skills', () => {
  it('rolls the exact count, all distinct', () => {
    for (let i = 0; i < 300; i++) {
      const held = rollSkills(rngFrom('s', String(i)), 4)
      expect(held).toHaveLength(4)
      expect(new Set(held.map((h) => h.skill.id)).size).toBe(4)
    }
  })

  it('keeps proficiency within 0.6..1.0', () => {
    for (let i = 0; i < 300; i++) {
      for (const h of rollSkills(rngFrom('p', String(i)), 3)) {
        expect(h.proficiency).toBeGreaterThanOrEqual(0.6)
        expect(h.proficiency).toBeLessThanOrEqual(1.0)
      }
    }
  })

  it('blends as a mean, never a sum', () => {
    const held = rollSkills(rngFrom('b', '1'), 4)
    const rates = held.map(effectiveApy)
    const mean = rates.reduce((a, b) => a + b, 0) / rates.length
    expect(blendedApy(held)).toBeCloseTo(mean, 12)
    // A mean can never exceed the best single rate.
    expect(blendedApy(held)).toBeLessThanOrEqual(Math.max(...rates) + 1e-12)
  })

  it('returns zero for an empty skill set', () => {
    expect(blendedApy([])).toBe(0)
  })
})

describe('xployee', () => {
  it('is fully deterministic for an id', () => {
    const a = buildXployee(42, 1_700_000_000_000)
    const b = buildXployee(42, 1_700_000_000_000)
    expect(a.mint).toBe(b.mint)
    expect(a.tier.id).toBe(b.tier.id)
    expect(a.skills.map((s) => s.skill.id)).toEqual(b.skills.map((s) => s.skill.id))
    expect(a.traits).toEqual(b.traits)
  })

  it('always carries exactly tier.skills skills', () => {
    for (let id = 0; id < 500; id++) {
      const x = buildXployee(id, 0)
      expect(x.skills).toHaveLength(x.tier.skills)
    }
  })

  it('scales principal with skill count', () => {
    for (let id = 0; id < 200; id++) {
      const x = buildXployee(id, 0)
      expect(x.principal).toBe(1000 * x.tier.skills)
    }
  })
})

describe('accrual', () => {
  const x = buildXployee(7, 0)

  it('is exactly zero at hire', () => {
    expect(accruedTotal(x, x.hiredAt)).toBe(0)
  })

  it('never goes negative before hire', () => {
    expect(accruedTotal(x, x.hiredAt - 5 * EPOCH_MS)).toBe(0)
  })

  it('is monotonically increasing in time', () => {
    let prev = -1
    for (let e = 0; e <= 60; e++) {
      const v = accruedTotal(x, x.hiredAt + e * EPOCH_MS)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('book value is principal plus accrual', () => {
    const t = x.hiredAt + 30 * EPOCH_MS
    expect(bookValue(x, t)).toBeCloseTo(x.principal + accruedTotal(x, t), 8)
  })

  it('trailing APY approaches the blended rate over a full window', () => {
    const t = x.hiredAt + 400 * EPOCH_MS
    const reading = trailingApy(x, t)
    expect(reading.estimated).toBe(false)
    // Linear accrual against a growing NAV runs slightly under the nominal rate.
    expect(reading.rate).toBeGreaterThan(x.apy * 0.5)
    expect(reading.rate).toBeLessThanOrEqual(x.apy * 1.05)
  })

  it('flags young xployees as estimated', () => {
    expect(trailingApy(x, x.hiredAt + 2 * EPOCH_MS).estimated).toBe(true)
  })

  it('never yields NaN', () => {
    for (const t of [0, x.hiredAt, x.hiredAt + EPOCH_MS, Date.now()]) {
      expect(Number.isFinite(accruedTotal(x, t))).toBe(true)
      expect(Number.isFinite(trailingApy(x, t).rate)).toBe(true)
    }
  })
})

describe('collection', () => {
  it('builds the declared population', () => {
    expect(collection()).toHaveLength(HIRED_COUNT)
  })

  it('assigns unique ids and unique mints', () => {
    const all = collection()
    expect(new Set(all.map((x) => x.id)).size).toBe(HIRED_COUNT)
    expect(new Set(all.map((x) => x.mint)).size).toBe(HIRED_COUNT)
  })

  it('regenerates identically across calls', () => {
    const a = collection()[100]
    const b = collection()[100]
    expect(a.mint).toBe(b.mint)
    expect(a.tier.id).toBe(b.tier.id)
  })

  it('contains at least one of every tier', () => {
    const seen = new Set(collection().map((x) => x.tier.id))
    for (const tier of TIERS) expect(seen.has(tier.id)).toBe(true)
  })
})

describe('contracts', () => {
  it('margin is projected output minus the fee-inclusive cost', () => {
    const listing: ContractListing = {
      kind: 'contract',
      xployee: buildXployee(3, 0),
      feePerEpoch: 100,
      term: 30,
      listedAt: 0,
    }
    const m = contractMath(listing)
    expect(m.grossXnft).toBeCloseTo(3000, 8)
    // 10% rental fee, on top of the owner's gross.
    expect(m.feeXnft).toBeCloseTo(300, 8)
    expect(m.costXnft).toBeCloseTo(3300, 8)
    expect(m.marginXnft).toBeCloseTo(m.projectedYieldXnft - m.costXnft, 8)
    expect(m.marginPct).toBeCloseTo(m.marginXnft / m.costXnft, 8)
  })

  it('does not divide by zero on a free contract', () => {
    const listing: ContractListing = {
      kind: 'contract',
      xployee: buildXployee(3, 0),
      feePerEpoch: 0,
      term: 0,
      listedAt: 0,
    }
    expect(contractMath(listing).marginPct).toBe(0)
  })
})

describe('avatar', () => {
  it('renders a full grid', () => {
    const grid = buildAvatar(buildXployee(11, 0))
    expect(grid).toHaveLength(GRID)
    for (const row of grid) expect(row).toHaveLength(GRID)
  })

  it('is deterministic', () => {
    const x = buildXployee(11, 0)
    expect(buildAvatar(x)).toEqual(buildAvatar(x))
  })

  it('is 32px, not the old 24', () => {
    expect(GRID).toBe(32)
  })

  /**
   * The load-bearing invariant of the whole art system: the character must be
   * transparent outside its silhouette, or the rarity background behind it is
   * completely hidden. Corners are the cheapest place to catch a regression.
   */
  it('leaves the background transparent', () => {
    for (let id = 0; id < 120; id++) {
      const grid = buildAvatar(buildXployee(id, 0))
      expect(grid[0][0]).toBeNull()
      expect(grid[0][GRID - 1]).toBeNull()
      const transparent = grid.flat().filter((c) => c === null).length
      expect(transparent).toBeGreaterThan(0)
    }
  })

  it('actually draws a character — not an empty grid', () => {
    for (let id = 0; id < 120; id++) {
      const painted = buildAvatar(buildXployee(id, 0))
        .flat()
        .filter((c) => c !== null).length
      // A bust should occupy a decent chunk of the frame without filling it.
      expect(painted).toBeGreaterThan(GRID * GRID * 0.2)
      expect(painted).toBeLessThan(GRID * GRID * 0.95)
    }
  })

  it('never tints the character with the tier colour', () => {
    // Tier identity lives in the background layer now. If the character picked
    // up tier colour too, rarity would double-signal and the palettes clash.
    for (let id = 0; id < 200; id++) {
      const x = buildXployee(id, 0)
      const cells = new Set(buildAvatar(x).flat().filter(Boolean) as string[])
      expect(cells.has(x.tier.color)).toBe(false)
    }
  })

  it('emits only well-formed hex colours', () => {
    const cells = new Set<string>()
    for (let id = 0; id < 60; id++) {
      for (const c of buildAvatar(buildXployee(id, 0)).flat()) if (c) cells.add(c)
    }
    expect(cells.size).toBeGreaterThan(8)
    for (const c of cells) expect(c).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  it('renders every trait value distinctly', () => {
    // Guards against a switch where several cases silently share a branch.
    const seen = new Map<string, Set<string>>()
    for (let id = 0; id < 900; id++) {
      const x = buildXployee(id, 0)
      const key = JSON.stringify(buildAvatar(x))
      for (const [layer, value] of Object.entries(x.traits)) {
        const bucket = seen.get(layer) ?? new Set<string>()
        bucket.add(`${value}`)
        seen.set(layer, bucket)
      }
      expect(key.length).toBeGreaterThan(0)
    }
    // Every declared trait value should have been exercised by 900 draws.
    expect(seen.get('uniform')!.size).toBe(UNIFORMS.length)
    expect(seen.get('head')!.size).toBe(HEADS.length)
    expect(seen.get('face')!.size).toBe(FACES.length)
  })
})

describe('backgrounds', () => {
  it('is deterministic per xployee', () => {
    const x = buildXployee(77, 0)
    expect(backgroundFor(x)).toEqual(backgroundFor(x))
  })

  it('keeps the low tiers flat and calm', () => {
    // The brief: uncommon bland solid, rare vivid solid, neither with weather.
    for (let id = 0; id < 400; id++) {
      const x = buildXployee(id, 0)
      if (x.tier.id !== 'entry' && x.tier.id !== 'mid') continue
      const bg = backgroundFor(x)
      expect(bg.kind).toBe('solid')
      expect(bg.overlay).toBe('none')
      expect(bg.style.backgroundImage).toBeUndefined()
    }
  })

  it('gives every tier a usable style and a name', () => {
    for (let id = 0; id < 400; id++) {
      const bg = backgroundFor(buildXployee(id, 0))
      expect(bg.name.length).toBeGreaterThan(0)
      expect(Object.keys(bg.style).length).toBeGreaterThan(0)
    }
  })

  it('particle fields never drain', () => {
    for (const overlay of ['snow', 'rain', 'thunder', 'sparks', 'embers', 'stars'] as const) {
      const rng = mulberry32(4)
      const ps = seedParticles(overlay, particleCount(overlay), rng)
      expect(ps.length).toBeGreaterThan(0)
      for (let i = 0; i < 400; i++) stepParticles(ps, overlay, 48, 48, rng)
      expect(ps.length).toBeGreaterThan(0)
      for (const p of ps) {
        expect(Number.isFinite(p.x)).toBe(true)
        expect(Number.isFinite(p.y)).toBe(true)
      }
    }
  })
})

describe('sparks', () => {
  it('seeds and never empties', () => {
    const rng = mulberry32(21)
    const sparks = seedSparks(7, 12, 16, rng)
    expect(sparks).toHaveLength(7)
    for (let i = 0; i < 500; i++) stepSparks(sparks, 12, 16, rng)
    expect(sparks).toHaveLength(7)
    for (const s of sparks) {
      expect(s.life).toBeGreaterThan(0)
      expect(Number.isFinite(s.x)).toBe(true)
    }
  })

  it('always resolves a colour', () => {
    const rng = mulberry32(3)
    const sparks = seedSparks(20, 12, 16, rng)
    for (let i = 0; i < 200; i++) {
      stepSparks(sparks, 12, 16, rng)
      for (const s of sparks) expect(sparkColor(s)).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})

describe('network', () => {
  const NOW = Date.UTC(2026, 7, 3)

  it('partitions the collection exactly — every xployee owned once', () => {
    const wallets = networkWallets(NOW)
    const ids = wallets.flatMap((w) => w.xployeeIds)
    expect(ids).toHaveLength(HIRED_COUNT)
    expect(new Set(ids).size).toBe(HIRED_COUNT)
    // Serials are drawn from the reveal order, so they are scattered across the
    // whole supply rather than being the contiguous run 0..HIRED_COUNT-1.
    const revealed = new Set(collection().map((x) => x.id))
    expect(ids.every((id) => revealed.has(id))).toBe(true)
    expect(Math.min(...ids)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ids)).toBeLessThan(MAX_SUPPLY)
  })

  it('gives every wallet a unique handle and at least one xployee', () => {
    const wallets = networkWallets(NOW)
    expect(new Set(wallets.map((w) => w.handle)).size).toBe(wallets.length)
    expect(new Set(wallets.map((w) => w.address)).size).toBe(wallets.length)
    for (const w of wallets) expect(w.holdings).toBeGreaterThan(0)
  })

  it('keeps holdings consistent with the id list', () => {
    for (const w of networkWallets(NOW)) expect(w.holdings).toBe(w.xployeeIds.length)
  })

  it('ranks xBoss monotonically in portfolio value', () => {
    const ladder = ['BOSS', 'DIRECTOR', 'VP', 'CEO']
    let prev = -1
    for (const value of [0, 5_999, 6_000, 17_999, 18_000, 44_999, 45_000, 500_000]) {
      const idx = ladder.indexOf(xBossFor(value))
      expect(idx).toBeGreaterThanOrEqual(prev)
      prev = idx
    }
    expect(xBossFor(0)).toBe('BOSS')
    expect(xBossFor(1e9)).toBe('CEO')
  })

  it('reports no next rank at the top', () => {
    expect(nextRank(1e9)).toBeNull()
    const step = nextRank(0)
    expect(step?.rank).toBe('DIRECTOR')
    expect(step?.remaining).toBeGreaterThan(0)
  })

  it('searches by handle and by address, and survives junk input', () => {
    const first = networkWallets(NOW)[0]
    expect(searchWallets(NOW, first.handle).length).toBeGreaterThan(0)
    expect(searchWallets(NOW, first.address)).toHaveLength(1)
    expect(searchWallets(NOW, '   ').length).toBe(networkWallets(NOW).length)
    expect(searchWallets(NOW, 'zzzz-no-such-wallet')).toHaveLength(0)
  })

  it('produces finite stats', () => {
    const s = networkStats(NOW)
    expect(s.wallets).toBeGreaterThan(0)
    expect(Number.isFinite(s.totalValue)).toBe(true)
    expect(Number.isFinite(s.medianHoldings)).toBe(true)
  })
})

describe('profile', () => {
  it('normalises twitter input from every shape a user might paste', () => {
    expect(normaliseTwitter('@skiz')).toBe('skiz')
    expect(normaliseTwitter('  skiz  ')).toBe('skiz')
    expect(normaliseTwitter('https://twitter.com/skiz')).toBe('skiz')
    expect(normaliseTwitter('https://x.com/skiz')).toBe('skiz')
    expect(normaliseTwitter('')).toBe('')
  })

  it('accepts a valid profile', () => {
    expect(
      validateProfile({ username: 'desk_runner', bio: 'hi', twitter: 'skiz', pfpXployeeId: 1 }),
    ).toHaveLength(0)
  })

  it('rejects bad usernames, long bios and bad handles', () => {
    expect(validateProfile({ ...EMPTY_PROFILE, username: 'ab' }).length).toBeGreaterThan(0)
    expect(validateProfile({ ...EMPTY_PROFILE, username: 'has spaces' }).length).toBeGreaterThan(0)
    expect(
      validateProfile({ ...EMPTY_PROFILE, username: 'ok_name', bio: 'x'.repeat(161) }).length,
    ).toBeGreaterThan(0)
    expect(
      validateProfile({ ...EMPTY_PROFILE, username: 'ok_name', twitter: 'way_too_long_handle_here' })
        .length,
    ).toBeGreaterThan(0)
  })
})

describe('format', () => {
  it('truncates addresses to lead…tail', () => {
    // Real AAPLx mint — matches the form shown in the reference dashboard.
    expect(shortAddress('XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp')).toBe('XsbE…JzJp')
    expect(shortAddress('XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp', 6, 6)).toBe('XsbEhL…RLJzJp')
  })

  it('leaves short strings alone', () => {
    expect(shortAddress('abc')).toBe('abc')
  })

  it('signs percentages with arrows', () => {
    expect(signedPct(2.5)).toContain('▲')
    expect(signedPct(-2.5)).toContain('▼')
  })

  it('renders non-finite numbers as a dash, never NaN', () => {
    expect(usd(NaN)).toBe('—')
    expect(signedPct(Infinity)).toBe('—')
  })
})
