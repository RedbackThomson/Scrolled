// Presentation for mob element statuses: how each status reads and looks in the
// UI. Display concerns (copy + Tailwind classes) live here, not in the domain
// decoder (@scrolled/game-db/domain/mobElements), which only maps WZ codes to
// the canonical ElementStatus.

import type { ElementStatus } from '@scrolled/game-db/domain/mobElements';

/** Short label for a mob's per-element status, used in detail-page tables. */
export const ELEMENT_STATUS_LABELS: Record<ElementStatus, string> = {
  neutral: 'Neutral',
  immune: 'Immune',
  resistant: 'Resistant',
  weak: 'Weak',
};

/** Section/header label when grouping elements by status (hover cards,
 *  list-page column headers). Phrased as how the *mob* relates to the element. */
export const ELEMENT_GROUP_LABELS: Record<ElementStatus, string> = {
  neutral: 'Neutral',
  immune: 'Immune to',
  resistant: 'Strong against',
  weak: 'Weak against',
};

/** Tailwind text-color class for each status. Kept in parity with the sidebar
 *  palette so the hover card, list cell, and detail row visually agree on what
 *  "immune" looks like. */
export const ELEMENT_STATUS_CLASSES: Record<ElementStatus, string> = {
  neutral: 'text-muted-foreground',
  immune: 'text-sky-700 dark:text-sky-300',
  resistant: 'text-amber-700 dark:text-amber-300',
  weak: 'text-rose-700 dark:text-rose-300',
};
