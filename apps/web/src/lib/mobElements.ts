// Canonical source of truth for everything mob-element related on the UI
// side. `info/elemAttr` in Mob.wz is a flat string like "I2F3" — pairs of
// element code + level. Level 1 = immune, 2 = resistant, 3 = weak. Anything
// not listed is neutral.
//
// `db/queries.ts` deliberately duplicates the element-code map (matching
// the EQUIP_CLASS_BITS pattern) to keep `db/` free of UI imports — if you
// change ELEMENT_NAMES here, mirror it there too.

export type ElementStatus = 'neutral' | 'immune' | 'resistant' | 'weak';

export const ELEMENT_NAMES = {
  I: 'Ice',
  L: 'Lightning',
  F: 'Fire',
  S: 'Poison',
  H: 'Holy',
  D: 'Dark',
  P: 'Physical',
} as const;

export type ElementName = (typeof ELEMENT_NAMES)[keyof typeof ELEMENT_NAMES];
export type ElementCode = keyof typeof ELEMENT_NAMES;

export const ELEMENT_ORDER: readonly ElementName[] = Object.values(ELEMENT_NAMES);

/** Lowercase name → WZ code. Powers case-insensitive lookups (palette
 *  grammar uses lowercase, column popovers pass Title-Case). */
export const ELEMENT_CODE_BY_NAME: Readonly<Record<string, ElementCode>> = Object.freeze(
  Object.fromEntries(
    (Object.entries(ELEMENT_NAMES) as [ElementCode, ElementName][]).map(([code, name]) => [
      name.toLowerCase(),
      code,
    ]),
  ) as Record<string, ElementCode>,
);

export const STATUS_BY_LEVEL = {
  '1': 'immune',
  '2': 'resistant',
  '3': 'weak',
} as const satisfies Record<string, ElementStatus>;

export type ElementLevel = keyof typeof STATUS_BY_LEVEL;

/** Inverse of STATUS_BY_LEVEL. Only the three "active" statuses have a
 *  level — `neutral` has no encoding in the elemAttr string. */
export const LEVEL_BY_STATUS = {
  immune: '1',
  resistant: '2',
  weak: '3',
} as const satisfies Record<Exclude<ElementStatus, 'neutral'>, ElementLevel>;

/** Short label for a mob's per-element status, used in detail-page tables. */
export const ELEMENT_STATUS_LABELS: Record<ElementStatus, string> = {
  neutral: 'Neutral',
  immune: 'Immune',
  resistant: 'Resistant',
  weak: 'Weak',
};

/** Section/header label when grouping elements by status (hover cards,
 *  list-page column headers). Phrased as how the *mob* relates to the
 *  element, not the other way around. */
export const ELEMENT_GROUP_LABELS: Record<ElementStatus, string> = {
  neutral: 'Neutral',
  immune: 'Immune to',
  resistant: 'Strong against',
  weak: 'Weak against',
};

/** Tailwind text-color class for each status. Keep parity with the
 *  sidebar palette so the hover card, list cell, and detail row all
 *  visually agree on what "immune" looks like. */
export const ELEMENT_STATUS_CLASSES: Record<ElementStatus, string> = {
  neutral: 'text-muted-foreground',
  immune: 'text-sky-700 dark:text-sky-300',
  resistant: 'text-amber-700 dark:text-amber-300',
  weak: 'text-rose-700 dark:text-rose-300',
};

export function parseMobElements(element?: string | null): Record<ElementName, ElementStatus> {
  const result = {} as Record<ElementName, ElementStatus>;
  for (const name of ELEMENT_ORDER) result[name] = 'neutral';
  if (!element) return result;
  for (const [, code, level] of element.matchAll(/([ILFSHDP])([123])/g)) {
    result[ELEMENT_NAMES[code as ElementCode]] = STATUS_BY_LEVEL[level as ElementLevel];
  }
  return result;
}

/** Names of elements the mob has the given status against, in canonical
 *  ELEMENT_ORDER. Empty for `neutral` is meaningful (the rest of the
 *  bestiary), but UIs typically only render the three active statuses. */
export function elementsByStatus(
  element: string | null | undefined,
  status: ElementStatus,
): ElementName[] {
  const parsed = parseMobElements(element);
  return ELEMENT_ORDER.filter((name) => parsed[name] === status);
}
