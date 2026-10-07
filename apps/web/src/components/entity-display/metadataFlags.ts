import type { ChipProps } from '@scrolled/design';

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
  chip: Pick<ChipProps, 'tone' | 'hue'>;
}

// Single source of truth for flag copy + color. Labels are title-cased and
// trademark-free per docs/writing_conventions.md — note `tradeAvailable` is
// described generically rather than naming the in-game tradeability-reset item.
export const METADATA_FLAGS: Record<MetadataFlagKey, MetadataFlagDef> = {
  cash: { label: 'Cash Item', chip: { tone: 'hue', hue: 350 } },
  tradeBlock: { label: 'Permanently Untradeable', chip: { tone: 'danger' } },
  equipTradeBlock: { label: 'Untradeable After Equip', chip: { tone: 'hue', hue: 75 } },
  accountSharable: { label: 'Tradable Within Account', chip: { tone: 'hue', hue: 245 } },
  only: { label: 'Unique Item', chip: { tone: 'hue', hue: 295 } },
  quest: { label: 'Quest Item', chip: { tone: 'hue', hue: 150 } },
  timeLimited: { label: 'Item Expires', chip: { tone: 'hue', hue: 75 } },
  expireOnLogout: { label: 'Removed on Logout', chip: { tone: 'hue', hue: 75 } },
  pickupBlock: { label: 'Cannot Possess Duplicates', chip: { tone: 'neutral' } },
  notSale: { label: 'Cannot Sell to NPC', chip: { tone: 'neutral' } },
  dropBlock: { label: 'Cannot Drop', chip: { tone: 'neutral' } },
  tradeAvailable: { label: 'Tradeability Can Be Reset', chip: { tone: 'hue', hue: 245 } },
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
