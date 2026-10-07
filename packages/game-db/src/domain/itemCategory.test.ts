import { describe, expect, it } from 'vitest';
import { inventoryCategoryOf } from './itemCategory';

describe('inventoryCategoryOf', () => {
  it('reads the inventory tab from the leading digit', () => {
    expect(inventoryCategoryOf(1_302_000)).toBe('equip');
    expect(inventoryCategoryOf(2_000_000)).toBe('use');
    expect(inventoryCategoryOf(3_010_000)).toBe('setup');
    expect(inventoryCategoryOf(4_000_000)).toBe('etc');
    expect(inventoryCategoryOf(5_000_000)).toBe('cash');
  });

  it('returns null outside the item ranges', () => {
    expect(inventoryCategoryOf(100_000)).toBeNull();
    expect(inventoryCategoryOf(9_000_000)).toBeNull();
  });
});
