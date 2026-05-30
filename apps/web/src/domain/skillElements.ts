// Decoders for the two enum-shaped fields persisted on `skills`: the
// element a skill is associated with (`elemAttr`) and the weapon a
// character must equip to cast it (`weapon`). Codes are stored raw on
// the row so this module can grow new entries without a migration.
//
// Element codes share an alphabet with the mob-element encoding (see
// `domain/mobElements.ts`) but appear here as a standalone character,
// not a `<code><level>` pair — a skill is either fire-aligned or it
// isn't, no "weak/strong/immune" levels.

export const SKILL_ELEMENT_NAMES = {
  F: 'Fire',
  I: 'Ice',
  L: 'Lightning',
  S: 'Poison',
  H: 'Holy',
  D: 'Dark',
  P: 'Physical',
} as const;

export type SkillElementCode = keyof typeof SKILL_ELEMENT_NAMES;
export type SkillElementName = (typeof SKILL_ELEMENT_NAMES)[SkillElementCode];

export const SKILL_ELEMENT_ORDER: readonly SkillElementName[] = Object.values(SKILL_ELEMENT_NAMES);

/** Lowercase name → code, for case-insensitive filter lookups. */
export const SKILL_ELEMENT_CODE_BY_NAME: Readonly<Record<string, SkillElementCode>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(SKILL_ELEMENT_NAMES) as [SkillElementCode, SkillElementName][]).map(
      ([code, name]) => [name.toLowerCase(), code],
    ),
  ) as Record<string, SkillElementCode>,
);

/**
 * Decode a raw `elemAttr` code to a human-readable label. Returns null
 * for null/empty input or unrecognized codes — the UI shows the raw
 * code in that case rather than fabricating a label.
 */
export function decodeSkillElement(code: string | null | undefined): SkillElementName | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  return SKILL_ELEMENT_NAMES[trimmed as SkillElementCode] ?? null;
}

/**
 * Weapon-type codes a skill's `weapon` property can carry. The numbers
 * come from the WZ data verbatim and match the equip's `equipType /
 * subtype` field — they're the second pair of digits in an equip ID
 * (e.g. one-handed sword equips share the leading digits `130`, and a
 * `weapon: "30"` skill row gates to "One-handed sword" equips).
 *
 * Codes outside this table appear on niche / cash-shop skills; the
 * decoder returns null so the UI shows the raw code rather than guess.
 */
export const REQUIRED_WEAPON_NAMES: Readonly<Record<string, string>> = {
  '30': 'One-handed sword',
  '31': 'One-handed axe',
  '32': 'One-handed blunt weapon',
  '33': 'Dagger',
  '37': 'Wand',
  '38': 'Staff',
  '40': 'Two-handed sword',
  '41': 'Two-handed axe',
  '42': 'Two-handed blunt weapon',
  '43': 'Spear',
  '44': 'Polearm',
  '45': 'Bow',
  '46': 'Crossbow',
  '47': 'Claw',
  '48': 'Knuckle',
  '49': 'Gun',
};

/**
 * Decode a raw `weapon` code to a human-readable label. Whitespace and
 * leading zeros are stripped, so `" 030"` → `"30"`. Returns null for
 * missing or unknown codes.
 */
export function decodeRequiredWeapon(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().replace(/^0+(?=\d)/, '');
  if (!normalized) return null;
  return REQUIRED_WEAPON_NAMES[normalized] ?? null;
}
