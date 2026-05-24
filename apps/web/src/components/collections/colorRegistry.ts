// Curated color set for collections. Names map to Tailwind class triples
// so the JIT can statically extract every used class — referencing the
// classes via string concatenation would not survive purge.
//
// The "neutral" entry covers the no-color-set case (`color === null`) and
// uses the same theme tokens as the rest of the UI, so a default
// collection blends in with regular surfaces.

export interface CollectionColorOption {
  name: string;
  label: string;
  /** Background + text for a small pill / chip rendering. */
  chip: string;
  /** Tinted block used for the larger icon container on detail pages. */
  iconBg: string;
  /** Icon foreground color, paired with `iconBg`. */
  iconColor: string;
  /** Border / outline class used when the option is selected in the picker. */
  swatch: string;
}

export const COLLECTION_COLORS: readonly CollectionColorOption[] = [
  {
    name: 'neutral',
    label: 'Neutral',
    chip: 'bg-muted/40 text-foreground',
    iconBg: 'bg-muted',
    iconColor: 'text-muted-foreground',
    swatch: 'bg-muted',
  },
  {
    name: 'red',
    label: 'Red',
    chip: 'bg-red-500/15 text-red-700 dark:text-red-300',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-700 dark:text-red-300',
    swatch: 'bg-red-500',
  },
  {
    name: 'orange',
    label: 'Orange',
    chip: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-700 dark:text-orange-300',
    swatch: 'bg-orange-500',
  },
  {
    name: 'amber',
    label: 'Amber',
    chip: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-700 dark:text-amber-300',
    swatch: 'bg-amber-500',
  },
  {
    name: 'green',
    label: 'Green',
    chip: 'bg-green-500/15 text-green-700 dark:text-green-300',
    iconBg: 'bg-green-500/15',
    iconColor: 'text-green-700 dark:text-green-300',
    swatch: 'bg-green-500',
  },
  {
    name: 'teal',
    label: 'Teal',
    chip: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-700 dark:text-teal-300',
    swatch: 'bg-teal-500',
  },
  {
    name: 'sky',
    label: 'Sky',
    chip: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    iconBg: 'bg-sky-500/15',
    iconColor: 'text-sky-700 dark:text-sky-300',
    swatch: 'bg-sky-500',
  },
  {
    name: 'indigo',
    label: 'Indigo',
    chip: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    iconBg: 'bg-indigo-500/15',
    iconColor: 'text-indigo-700 dark:text-indigo-300',
    swatch: 'bg-indigo-500',
  },
  {
    name: 'violet',
    label: 'Violet',
    chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-700 dark:text-violet-300',
    swatch: 'bg-violet-500',
  },
  {
    name: 'pink',
    label: 'Pink',
    chip: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
    iconBg: 'bg-pink-500/15',
    iconColor: 'text-pink-700 dark:text-pink-300',
    swatch: 'bg-pink-500',
  },
] as const;

export const DEFAULT_COLLECTION_COLOR: CollectionColorOption = COLLECTION_COLORS[0];

const COLOR_BY_NAME = new Map<string, CollectionColorOption>(
  COLLECTION_COLORS.map((o) => [o.name, o]),
);

export function resolveCollectionColor(
  name: string | null | undefined,
): CollectionColorOption {
  if (!name) return DEFAULT_COLLECTION_COLOR;
  return COLOR_BY_NAME.get(name) ?? DEFAULT_COLLECTION_COLOR;
}
