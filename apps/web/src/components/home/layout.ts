// Home-page layout model.
//
// Each widget the user can show/hide/reorder is identified by a stable
// `HomeSectionId`. The persisted layout is one ordered list of
// `{ id, visible }` entries — adding a new widget in code means
// appending its id here; old saved layouts still load because the
// reconciler in `useHomeLayout` merges saved order against the current
// registry rather than replacing it.

import { z } from 'zod';

export const HOME_SECTION_IDS = [
  'continue',
  'pinned-collections',
  'pinned-searches',
  'browse',
  'regions',
  'library',
  'mob-histogram',
  'equip-breakdown',
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

/** Display name shown in the hidden-sections strip and on each section's
 *  header during edit mode. Kept here so the layout reducer can label
 *  hidden rows without importing the widget components. */
export const HOME_SECTION_LABEL: Record<HomeSectionId, string> = {
  continue: 'Continue',
  'pinned-collections': 'Pinned collections',
  'pinned-searches': 'Saved searches',
  browse: 'Browse',
  regions: 'Regions',
  library: 'Library',
  'mob-histogram': 'Mobs by level',
  'equip-breakdown': 'Equip restrictions',
};

/** Default order, used by first-time visitors and as the baseline the
 *  reconciler appends to when new sections ship after a saved layout. */
export const DEFAULT_HOME_LAYOUT: HomeLayoutEntry[] = HOME_SECTION_IDS.map((id) => ({
  id,
  visible: true,
}));

export const homeSectionIdSchema = z.enum(HOME_SECTION_IDS);

export const homeLayoutEntrySchema = z.object({
  id: homeSectionIdSchema,
  visible: z.boolean(),
});

export const homeLayoutSchema = z.object({
  entries: z.array(homeLayoutEntrySchema),
});

export type HomeLayoutEntry = z.infer<typeof homeLayoutEntrySchema>;
export type HomeLayout = z.infer<typeof homeLayoutSchema>;

/**
 * Merge a saved layout with the canonical id list.
 *
 *   - Saved entries keep their order and `visible` flag.
 *   - Ids not in the saved layout are appended at the end (visible).
 *   - Saved ids no longer in the registry are dropped — they're stale
 *     from an old build and don't match a known widget.
 *
 * Pure function so the unit case is testable without React.
 */
export function reconcileLayout(saved: HomeLayout | null | undefined): HomeLayoutEntry[] {
  const knownIds = new Set<HomeSectionId>(HOME_SECTION_IDS);
  const out: HomeLayoutEntry[] = [];
  const seen = new Set<HomeSectionId>();
  if (saved?.entries) {
    for (const entry of saved.entries) {
      if (!knownIds.has(entry.id) || seen.has(entry.id)) continue;
      seen.add(entry.id);
      out.push(entry);
    }
  }
  for (const id of HOME_SECTION_IDS) {
    if (!seen.has(id)) out.push({ id, visible: true });
  }
  return out;
}

/** Move the entry at `from` to `to` in a new array. Out-of-range
 *  arguments are clamped; callers don't need to validate. */
export function moveEntry<T>(arr: T[], from: number, to: number): T[] {
  const n = arr.length;
  if (n <= 1) return arr.slice();
  const fromClamped = Math.max(0, Math.min(n - 1, from));
  const toClamped = Math.max(0, Math.min(n - 1, to));
  if (fromClamped === toClamped) return arr.slice();
  const copy = arr.slice();
  const [item] = copy.splice(fromClamped, 1);
  if (item === undefined) return arr.slice();
  copy.splice(toClamped, 0, item);
  return copy;
}
