import { describe, expect, it } from 'vitest';
import {
  applyExpRate,
  BUILTIN_PROFILES,
  calculateEquipRanges,
  DEFAULT_PROFILE_ID,
  detectServerProfile,
  listEquipStatCalculatorIds,
  profileExpRate,
  registerEquipStatCalculator,
  resolveServerProfile,
  serverProfileSchema,
  type EquipBaseStats,
  type FingerprintReader,
  type ServerProfile,
} from './index';

// --- fixtures --------------------------------------------------------------
//
// Tests run against synthetic profiles, not the shipped ones, so edge cases
// the real profiles don't exercise (missing calculators, fractional rates,
// negative stats, …) get covered. Profiles reference calculators by id; we
// register deterministic mock calculators so the engine's wiring can be
// asserted independently of the real variance formulas.

registerEquipStatCalculator({
  // base ± 2 with a godly tier at base + 10 — fixed so the engine's merge
  // behaviour (skip null/zero, pass the range through) is what's under test.
  id: 'test-fixed',
  range: (_stat, base) =>
    base === 0 ? null : { base, min: base - 2, max: base + 2, godlyMax: base + 10 },
});

registerEquipStatCalculator({
  // Declines every stat — exercises the "calculator returned null" path.
  id: 'test-declines',
  range: () => null,
});

function mockProfile(overrides: Partial<ServerProfile> = {}): ServerProfile {
  return { id: 'mock', name: 'Mock', rates: {}, systems: {}, ...overrides };
}

function stats(partial: Partial<EquipBaseStats> = {}): EquipBaseStats {
  return {
    attack: null,
    magicAttack: null,
    defense: null,
    magicDefense: null,
    accuracy: null,
    avoidability: null,
    ...partial,
  };
}

// --- applyExpRate ----------------------------------------------------------

describe('applyExpRate', () => {
  it('preserves null regardless of rate', () => {
    expect(applyExpRate(3, null)).toBeNull();
    expect(applyExpRate(0.5, null)).toBeNull();
  });

  it('is the identity at rate 1', () => {
    expect(applyExpRate(1, 1234)).toBe(1234);
    expect(applyExpRate(1, 0)).toBe(0);
  });

  it('scales by integer rates', () => {
    expect(applyExpRate(3, 100)).toBe(300);
    expect(applyExpRate(1000, 12345)).toBe(12_345_000);
  });

  it('rounds fractional results half away from zero', () => {
    expect(applyExpRate(1.5, 33)).toBe(50); // 49.5
    expect(applyExpRate(0.5, 3)).toBe(2); // 1.5
    expect(applyExpRate(0.5, 1)).toBe(1); // 0.5
    expect(applyExpRate(2.5, 5)).toBe(13); // 12.5
  });

  it('keeps zero exp at zero for any rate', () => {
    expect(applyExpRate(99, 0)).toBe(0);
  });
});

// --- profileExpRate --------------------------------------------------------

describe('profileExpRate', () => {
  it('reads the declared exp rate', () => {
    expect(profileExpRate(mockProfile({ rates: { exp: 5 } }))).toBe(5);
    expect(profileExpRate(mockProfile({ rates: { exp: 0.5 } }))).toBe(0.5);
  });

  it('defaults to 1 when the profile declares no exp rate', () => {
    expect(profileExpRate(mockProfile({ rates: {} }))).toBe(1);
    expect(profileExpRate(mockProfile())).toBe(1);
  });
});

// --- calculateEquipRanges (engine wiring, via mock calculator) -------------

describe('calculateEquipRanges — engine wiring', () => {
  const fixed = mockProfile({ systems: { equipStatCalculation: 'test-fixed' } });

  it('ranges every non-null, non-zero stat and leaves others undefined', () => {
    const r = calculateEquipRanges(fixed, stats({ attack: 10, defense: 50 }));
    expect(r.attack).toEqual({ base: 10, min: 8, max: 12, godlyMax: 20 });
    expect(r.defense).toEqual({ base: 50, min: 48, max: 52, godlyMax: 60 });
    expect(r.magicAttack).toBeUndefined();
    expect(r.avoidability).toBeUndefined();
  });

  it('omits null and zero stats but keeps siblings', () => {
    const r = calculateEquipRanges(fixed, stats({ attack: 0, defense: null, accuracy: 7 }));
    expect(r.attack).toBeUndefined();
    expect(r.defense).toBeUndefined();
    expect(r.accuracy).toEqual({ base: 7, min: 5, max: 9, godlyMax: 17 });
  });

  it('passes negative base values through the calculator', () => {
    const r = calculateEquipRanges(fixed, stats({ accuracy: -5 }));
    expect(r.accuracy).toEqual({ base: -5, min: -7, max: -3, godlyMax: 5 });
  });

  it('returns {} when the calculator declines every stat', () => {
    const p = mockProfile({ systems: { equipStatCalculation: 'test-declines' } });
    expect(calculateEquipRanges(p, stats({ attack: 99, defense: 10 }))).toEqual({});
  });

  it('returns {} when the referenced calculator is not registered', () => {
    const p = mockProfile({ systems: { equipStatCalculation: 'does-not-exist' } });
    expect(calculateEquipRanges(p, stats({ attack: 99 }))).toEqual({});
  });

  it('returns {} when the profile declares no calculator', () => {
    expect(calculateEquipRanges(mockProfile(), stats({ attack: 99 }))).toEqual({});
  });

  it('returns {} for all-null stats', () => {
    expect(calculateEquipRanges(fixed, stats())).toEqual({});
  });
});

// --- calculateEquipRanges (real calculators, via mock profiles) ------------

describe('calculateEquipRanges — built-in calculators', () => {
  const vanilla = mockProfile({ systems: { equipStatCalculation: 'vanilla-v83' } });
  const royals = mockProfile({ systems: { equipStatCalculation: 'mapleroyals-v1' } });

  it('vanilla: symmetric ±10% range with a floor of 1, no godly tier', () => {
    expect(calculateEquipRanges(vanilla, stats({ attack: 15 })).attack).toEqual({
      base: 15,
      min: 13,
      max: 17,
    });
    // 10% of 3 rounds to 0, so the variance floor of 1 kicks in.
    expect(calculateEquipRanges(vanilla, stats({ defense: 3 })).defense).toEqual({
      base: 3,
      min: 2,
      max: 4,
    });
    // 10% of 200 = 20.
    expect(calculateEquipRanges(vanilla, stats({ defense: 200 })).defense).toEqual({
      base: 200,
      min: 180,
      max: 220,
    });
  });

  it('mapleroyals: same range plus a +5 godly tier (PRD example 15 → 13 ~ 17 or 22)', () => {
    expect(calculateEquipRanges(royals, stats({ attack: 15 })).attack).toEqual({
      base: 15,
      min: 13,
      max: 17,
      godlyMax: 22,
    });
  });

  it('both treat a 0 stat as having no range', () => {
    expect(calculateEquipRanges(vanilla, stats({ attack: 0 }))).toEqual({});
    expect(calculateEquipRanges(royals, stats({ attack: 0 }))).toEqual({});
  });
});

// --- serverProfileSchema ---------------------------------------------------

describe('serverProfileSchema', () => {
  it('accepts a minimal profile and applies rate/system defaults', () => {
    const r = serverProfileSchema.safeParse({ id: 'x', name: 'X' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rates).toEqual({});
      expect(r.data.systems).toEqual({});
    }
  });

  it('rejects a missing or empty id / name', () => {
    expect(serverProfileSchema.safeParse({ name: 'X' }).success).toBe(false);
    expect(serverProfileSchema.safeParse({ id: 'x' }).success).toBe(false);
    expect(serverProfileSchema.safeParse({ id: '', name: 'X' }).success).toBe(false);
  });

  it('rejects a non-positive exp rate', () => {
    expect(serverProfileSchema.safeParse({ id: 'x', name: 'X', rates: { exp: 0 } }).success).toBe(
      false,
    );
    expect(serverProfileSchema.safeParse({ id: 'x', name: 'X', rates: { exp: -2 } }).success).toBe(
      false,
    );
  });

  it('strips unknown top-level keys so newer files load on older builds', () => {
    const r = serverProfileSchema.safeParse({ id: 'x', name: 'X', future: 'whatever' });
    expect(r.success).toBe(true);
    if (r.success) expect('future' in r.data).toBe(false);
  });

  it('accepts an optional version string', () => {
    const r = serverProfileSchema.safeParse({ id: 'x', name: 'X', version: '2026-05-26' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.version).toBe('2026-05-26');
    // empty version is rejected
    expect(serverProfileSchema.safeParse({ id: 'x', name: 'X', version: '' }).success).toBe(false);
  });

  it('accepts well-formed fingerprints and rejects malformed ones', () => {
    const ok = serverProfileSchema.safeParse({
      id: 'x',
      name: 'X',
      fingerprints: [{ file: 'String.wz', path: 'EULA.img/EULA/Text00', contains: 'Foo' }],
    });
    expect(ok.success).toBe(true);
    // missing `contains`
    expect(
      serverProfileSchema.safeParse({
        id: 'x',
        name: 'X',
        fingerprints: [{ file: 'String.wz', path: 'EULA.img/EULA/Text00' }],
      }).success,
    ).toBe(false);
    // empty `file`
    expect(
      serverProfileSchema.safeParse({
        id: 'x',
        name: 'X',
        fingerprints: [{ file: '', path: 'p', contains: 'c' }],
      }).success,
    ).toBe(false);
  });
});

// --- detectServerProfile (against the real shipped fingerprints) -----------

describe('detectServerProfile', () => {
  const EULA = 'EULA.img/EULA/Text00';
  // Returns `value` only at the real fingerprint source; null elsewhere.
  const readerReturning =
    (value: string | null): FingerprintReader =>
    async (file, path) =>
      file === 'String.wz' && path === EULA ? value : null;

  it('matches the MapleRoyals fingerprint in the EULA text', async () => {
    const p = await detectServerProfile(readerReturning('…as governed by the MapleRoyals team…'));
    expect(p?.id).toBe('mapleroyals-compatible');
  });

  it('matches case-insensitively', async () => {
    const p = await detectServerProfile(readerReturning('welcome to mapleroyals'));
    expect(p?.id).toBe('mapleroyals-compatible');
  });

  it('returns null when no fingerprint string matches', async () => {
    expect(await detectServerProfile(readerReturning('Some other server EULA'))).toBeNull();
  });

  it('returns null when the value is absent', async () => {
    expect(await detectServerProfile(async () => null)).toBeNull();
  });

  it('treats a throwing read as no match rather than propagating', async () => {
    const p = await detectServerProfile(async () => {
      throw new Error('parse failed');
    });
    expect(p).toBeNull();
  });
});

// --- resolveServerProfile (resolves against the real registry) -------------

describe('resolveServerProfile', () => {
  it('falls back to the baseline for unknown / null ids', () => {
    expect(resolveServerProfile(undefined).id).toBe(DEFAULT_PROFILE_ID);
    expect(resolveServerProfile(null).id).toBe(DEFAULT_PROFILE_ID);
    expect(resolveServerProfile('nope').id).toBe(DEFAULT_PROFILE_ID);
  });

  it('resolves a shipped profile id', () => {
    expect(resolveServerProfile('mapleroyals-compatible').id).toBe('mapleroyals-compatible');
  });
});

// --- CI guard: the actual shipped profiles + directory ---------------------
//
// These intentionally use the real BUILTIN_PROFILES: their whole job is to
// catch a malformed or mis-wired drop-in JSON file before it ships. They run
// in `pnpm test`, failing the pipeline rather than degrading at runtime.

describe('shipped profile directory integrity (CI guard)', () => {
  it('loads the directory plus the baseline, baseline first', () => {
    expect(BUILTIN_PROFILES.length).toBeGreaterThanOrEqual(2);
    expect(BUILTIN_PROFILES[0].id).toBe(DEFAULT_PROFILE_ID);
  });

  it('includes the MapleRoyals-compatible profile loaded from JSON', () => {
    expect(BUILTIN_PROFILES.some((p) => p.id === 'mapleroyals-compatible')).toBe(true);
  });

  it('ships the MapleRoyals EULA fingerprint', () => {
    const mr = BUILTIN_PROFILES.find((p) => p.id === 'mapleroyals-compatible');
    const hit = mr?.fingerprints?.some(
      (f) =>
        f.file === 'String.wz' &&
        f.path === 'EULA.img/EULA/Text00' &&
        /mapleroyals/i.test(f.contains),
    );
    expect(hit).toBe(true);
  });

  it('every shipped profile passes schema validation', () => {
    for (const p of BUILTIN_PROFILES) {
      expect(serverProfileSchema.safeParse(p).success).toBe(true);
    }
  });

  it('has no duplicate ids', () => {
    const ids = BUILTIN_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every referenced equip-stat calculator is registered', () => {
    const registered = new Set(listEquipStatCalculatorIds());
    for (const p of BUILTIN_PROFILES) {
      const calcId = p.systems.equipStatCalculation;
      if (calcId) expect(registered.has(calcId), `${p.id} → ${calcId}`).toBe(true);
    }
  });
});
