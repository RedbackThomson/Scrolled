import type { BadgeTone } from '@scrolled/ui';

/**
 * Boolean metadata flags an item or equip can carry on its WZ `info` block.
 * Centralized so both detail pages render the same flag with the same label
 * and color. Not every entity has every flag — each page passes its own
 * ordered subset.
 */
export type MetadataFlagKey =
  | 'cash'
  | 'tradeBlock'
  | 'equipTradeBlock'
  | 'accountSharable'
  | 'only'
  | 'quest'
  | 'timeLimited'
  | 'expireOnLogout'
  | 'pickupBlock'
  | 'notSale'
  | 'dropBlock'
  | 'tradeAvailable';

interface MetadataFlagDef {
  label: string;
  tone: BadgeTone;
}

// Single source of truth for flag copy + color. Labels are title-cased and
// trademark-free per docs/writing_conventions.md — note `tradeAvailable` is
// described generically rather than naming the in-game tradeability-reset item.
export const METADATA_FLAGS: Record<MetadataFlagKey, MetadataFlagDef> = {
  cash: { label: 'Cash Item', tone: 'pink' },
  tradeBlock: { label: 'Permanently Untradeable', tone: 'red' },
  equipTradeBlock: { label: 'Untradeable After Equip', tone: 'amber' },
  accountSharable: { label: 'Tradable Within Account', tone: 'blue' },
  only: { label: 'Unique Item', tone: 'violet' },
  quest: { label: 'Quest Item', tone: 'emerald' },
  timeLimited: { label: 'Item Expires', tone: 'amber' },
  expireOnLogout: { label: 'Removed on Logout', tone: 'amber' },
  pickupBlock: { label: 'Cannot Possess Duplicates', tone: 'slate' },
  notSale: { label: 'Cannot Sell to NPC', tone: 'slate' },
  dropBlock: { label: 'Cannot Drop', tone: 'slate' },
  tradeAvailable: { label: 'Tradeability Can Be Reset', tone: 'blue' },
};

// Per-entity display order. Equips render `cash` as a bespoke
// "Cash Shop (cosmetic)" badge and have no drop/trade-reset flags, so their
// order is the restrictive subset.
export const EQUIP_FLAG_ORDER: readonly MetadataFlagKey[] = [
  'tradeBlock',
  'equipTradeBlock',
  'accountSharable',
  'only',
  'quest',
  'timeLimited',
  'expireOnLogout',
  'pickupBlock',
  'notSale',
];

export const ITEM_FLAG_ORDER: readonly MetadataFlagKey[] = [
  'cash',
  'tradeBlock',
  'accountSharable',
  'only',
  'quest',
  'pickupBlock',
  'dropBlock',
  'tradeAvailable',
  'notSale',
  'timeLimited',
  'expireOnLogout',
];
