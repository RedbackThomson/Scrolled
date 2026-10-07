// The client files every item under an inventory tab, and the tab is encoded in
// the id's leading digit. This mirrors the `items.category` values the
// extractor writes, so callers holding only an id (relation lists, links) can
// still tell a potion from an ore.

export type InventoryCategory = 'equip' | 'use' | 'setup' | 'etc' | 'cash';

const BY_PREFIX: Record<number, InventoryCategory> = {
  1: 'equip',
  2: 'use',
  3: 'setup',
  4: 'etc',
  5: 'cash',
};

export function inventoryCategoryOf(itemId: number): InventoryCategory | null {
  return BY_PREFIX[Math.floor(itemId / 1_000_000)] ?? null;
}
