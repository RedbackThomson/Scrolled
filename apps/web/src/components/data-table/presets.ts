import type { LucideIcon } from 'lucide-react';
import type { ColumnFilter } from '@/db';

/** A named filter set shown as a tile above a list page. */
export interface ListPreset {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Tile hue (0–360). */
  hue: number;
  /** Column id → filter; applying the preset replaces every active filter. */
  filters: Record<string, ColumnFilter>;
}

/** True when the active filters are exactly the preset's. */
export function presetMatches(preset: ListPreset, active: Record<string, ColumnFilter>): boolean {
  const keys = Object.keys(preset.filters);
  if (keys.length !== Object.keys(active).length) return false;
  return keys.every((k) => JSON.stringify(active[k]) === JSON.stringify(preset.filters[k]));
}

/** A column pinned to a list page's facet bar. */
export interface FacetDef {
  columnId: string;
  label: string;
  /** Pill fill when active (0–360). */
  hue: number;
  /** Number columns: preset ranges shown as chips under the slider. */
  quickRanges?: readonly { label: string; value: [number, number] }[];
  /** Number columns: offer "Around my level" from the character level in settings. */
  aroundMyLevel?: boolean;
}
