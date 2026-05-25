import type { LucideIcon } from 'lucide-react';
import type { EntityKind } from '@/db';

export type CommandGroupId =
  | 'context'
  | 'recents'
  | 'pinned'
  | 'results'
  | 'navigation'
  | 'filters'
  | 'collections'
  | 'toggles'
  | 'data'
  | 'fun';

export interface CommandItem {
  id: string;
  group: CommandGroupId;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  shortcut?: string;
  keywords?: string[];
  /** When set, used as cmdk's filter value. Search-result rows pass a unique
   *  per-row key here so cmdk doesn't reorder them under MiniSearch ranking. */
  value?: string;
  onSelect: () => void | Promise<void>;
}

export interface PalettePageContext {
  entity?: EntityKind;
  id?: number;
  name?: string;
}

export interface PaletteSelection {
  entity: EntityKind;
  ids: number[];
}

export const GROUP_LABELS: Record<CommandGroupId, string> = {
  context: 'On this page',
  recents: 'Recent',
  pinned: 'Pinned searches',
  results: 'Search results',
  navigation: 'Go to',
  filters: 'Filter',
  collections: 'Collections',
  toggles: 'Toggles',
  data: 'Data',
  fun: 'Explore',
};

export const GROUP_ORDER: CommandGroupId[] = [
  'context',
  'recents',
  'pinned',
  'results',
  'navigation',
  'filters',
  'collections',
  'toggles',
  'data',
  'fun',
];
