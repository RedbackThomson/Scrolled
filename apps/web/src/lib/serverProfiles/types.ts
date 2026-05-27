// Server Profile & Rules Engine — core types.
//
// A server profile is a declarative bundle of gameplay rule overrides. It
// carries no executable code: rates are plain numbers and systems reference
// calculators by id, so importing a profile can never run arbitrary logic.

/**
 * A signal that identifies a server from its game files. A fingerprint matches
 * when the string value at `<file>/<path>` contains `contains` (case-
 * insensitive). Profiles carry their own fingerprints so detection is
 * declarative data, not code.
 */
export interface ServerFingerprint {
  /** Logical WZ file name, e.g. "String.wz". */
  file: string;
  /** Property path within the file, e.g. "EULA.img/EULA/Text00". */
  path: string;
  /** Substring to look for in the property's string value (case-insensitive). */
  contains: string;
}

export interface ServerProfile {
  id: string;
  name: string;
  description?: string;
  /** Multipliers applied to canonical game values. */
  rates: {
    /** Multiplier applied to displayed EXP values. Defaults to 1 when absent. */
    exp?: number;
  };
  /** Pluggable rule systems, each referencing a registered calculator by id. */
  systems: {
    /** Id of the equip-stat-range calculator this profile uses. */
    equipStatCalculation?: string;
  };
  /** Optional signals used to auto-detect this profile from loaded game files. */
  fingerprints?: ServerFingerprint[];
}

/**
 * Canonical combat stats an equip carries, as base values from the WZ data.
 * These are the stats a dropped-equip variance calculator operates on —
 * requirement stats (level, STR req, …) and upgrade slots are excluded.
 */
export interface EquipBaseStats {
  attack: number | null;
  magicAttack: number | null;
  defense: number | null;
  magicDefense: number | null;
  accuracy: number | null;
  avoidability: number | null;
}

export type EquipStatKey = keyof EquipBaseStats;

export const EQUIP_STAT_KEYS: readonly EquipStatKey[] = [
  'attack',
  'magicAttack',
  'defense',
  'magicDefense',
  'accuracy',
  'avoidability',
];

/** A computed possible-roll range for one equip stat. */
export interface EquipStatRange {
  base: number;
  min: number;
  max: number;
  /**
   * Upper bound reachable only via a server's "godly" roll system, when the
   * profile's calculator models one. Omitted when there's no godly tier.
   */
  godlyMax?: number;
}

/**
 * A registered, trusted calculator. Implementations are native code shipped
 * with the app (or a fork) — never loaded from profile data.
 */
export interface EquipStatCalculator {
  id: string;
  /**
   * Possible dropped range for a single stat's base value. Returns null when
   * no meaningful range applies (e.g. a base of 0).
   */
  range(stat: EquipStatKey, base: number): EquipStatRange | null;
}
