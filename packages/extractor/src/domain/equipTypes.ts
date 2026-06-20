// Equip-type slugs derived from `Math.floor(id / 10000)`.
//
// Only the weapon buckets (130..149) are mapped today — `resolveEquipType`
// returns null for anything else, and the UI treats that as "not a weapon."
// Values are stable strings so the DB can store them and the UI can treat
// them as an enum without recomputing from the id each time. Lives in
// `lib/` (not `extractors/`) because both extraction and the routes/
// components layer need the slug ↔ label mapping.

export const EQUIP_TYPE_LOOKUP: Readonly<Record<number, string>> = {
  130: 'one-handed-sword',
  131: 'one-handed-axe',
  132: 'one-handed-mace',
  133: 'dagger',
  137: 'wand',
  138: 'staff',
  140: 'two-handed-sword',
  141: 'two-handed-axe',
  142: 'two-handed-mace',
  143: 'spear',
  144: 'polearm',
  145: 'bow',
  146: 'crossbow',
  147: 'claw',
  148: 'knuckle',
  149: 'gun',
  // 170 is the cash-shop weapon bucket — generic cosmetic overlays that
  // can be equipped over a regular weapon (e.g. Australia Cheer Towel).
  // They share the `weapon` slot but have no stats; we surface them under
  // /weapons so they're not hidden among non-weapon equips. If MapleRoyals
  // ever ships finer subdivisions (171/172/...), add them here.
  170: 'cash-weapon',
};

/** Stable order matching the lookup, used by the Weapons sidebar. */
export const WEAPON_TYPE_ORDER: readonly string[] = [
  'one-handed-sword',
  'one-handed-axe',
  'one-handed-mace',
  'dagger',
  'wand',
  'staff',
  'two-handed-sword',
  'two-handed-axe',
  'two-handed-mace',
  'spear',
  'polearm',
  'bow',
  'crossbow',
  'claw',
  'knuckle',
  'gun',
  'cash-weapon',
];

/**
 * Slug → display label (title-cased, spaces). Falls back to the slug
 * with hyphens swapped for spaces when an unknown value sneaks in (e.g.
 * from an older DB row before this table covered every bucket).
 */
export function labelForEquipType(slug: string): string {
  const spaced = slug.replace(/-/g, ' ');
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function resolveEquipType(id: number): string | null {
  const bucket = Math.floor(id / 10000);
  return EQUIP_TYPE_LOOKUP[bucket] ?? null;
}

/**
 * WZ slot names disagree with what MapleStory shows in-tab — e.g. the file
 * tree calls it "Longcoat" but the game UI says "Overall". We rewrite the
 * raw WZ slug to the player-facing one at extraction time so that the value
 * stored on `equips.slot` matches what users will type into filters and
 * see in URLs. Anything not listed passes through unchanged (lowercased).
 *
 * Adding a new entry? Also add a `UPDATE equips SET ...` branch to the
 * latest schema migration so DBs imported before the rename get normalized
 * in place rather than waiting for a re-extraction.
 */
const EQUIP_SLOT_NORMALIZATION: Readonly<Record<string, string>> = {
  cap: 'hat',
  coat: 'top',
  pants: 'bottom',
  longcoat: 'overall',
  petequip: 'pet-equip',
};

export function normalizeEquipSlot(raw: string): string {
  const lower = raw.toLowerCase();
  return EQUIP_SLOT_NORMALIZATION[lower] ?? lower;
}

export function labelForEquipSlot(slot: string): string {
  const spaced = slot.replace(/-/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}
