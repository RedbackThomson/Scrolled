import type { SortDir } from '../../types';

/**
 * Per-entity allowlist mapping public column ids → SQL column names plus
 * each column's default sort direction. The mapping is the security
 * boundary: `orderBy` strings come straight from URL query params, but
 * we never interpolate them into SQL — we look them up here and emit a
 * literal column name. Unknown keys fall back to the entity's default.
 */
export interface OrderSpec {
  col: string;
  defaultDir: SortDir;
}

export const ITEM_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  category: { col: 'category', defaultDir: 'asc' },
  subcategory: { col: 'subcategory', defaultDir: 'asc' },
  requiredLevel: { col: 'required_level', defaultDir: 'asc' },
  price: { col: 'price', defaultDir: 'desc' },
  id: { col: 'id', defaultDir: 'asc' },
};
export const ITEM_ORDER_DEFAULT = 'name';

export const EQUIP_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  slot: { col: 'slot', defaultDir: 'asc' },
  equipType: { col: 'equip_type', defaultDir: 'asc' },
  cash: { col: 'cash', defaultDir: 'asc' },
  requiredLevel: { col: 'required_level', defaultDir: 'asc' },
  requiredStr: { col: 'required_str', defaultDir: 'asc' },
  requiredDex: { col: 'required_dex', defaultDir: 'asc' },
  requiredInt: { col: 'required_int', defaultDir: 'asc' },
  requiredLuk: { col: 'required_luk', defaultDir: 'asc' },
  attack: { col: 'attack', defaultDir: 'desc' },
  magicAttack: { col: 'magic_attack', defaultDir: 'desc' },
  incStr: { col: 'inc_str', defaultDir: 'desc' },
  incDex: { col: 'inc_dex', defaultDir: 'desc' },
  incInt: { col: 'inc_int', defaultDir: 'desc' },
  incLuk: { col: 'inc_luk', defaultDir: 'desc' },
  incHp: { col: 'inc_hp', defaultDir: 'desc' },
  incMp: { col: 'inc_mp', defaultDir: 'desc' },
  defense: { col: 'defense', defaultDir: 'desc' },
  magicDefense: { col: 'magic_defense', defaultDir: 'desc' },
  accuracy: { col: 'accuracy', defaultDir: 'desc' },
  avoidability: { col: 'avoidability', defaultDir: 'desc' },
  incSpeed: { col: 'inc_speed', defaultDir: 'desc' },
  incJump: { col: 'inc_jump', defaultDir: 'desc' },
  upgradeSlots: { col: 'upgrade_slots', defaultDir: 'desc' },
  id: { col: 'id', defaultDir: 'asc' },
};
export const EQUIP_ORDER_DEFAULT = 'name';

export const MOB_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  level: { col: 'level', defaultDir: 'asc' },
  hp: { col: 'hp', defaultDir: 'asc' },
  mp: { col: 'mp', defaultDir: 'asc' },
  exp: { col: 'exp', defaultDir: 'desc' },
  id: { col: 'id', defaultDir: 'asc' },
};
export const MOB_ORDER_DEFAULT = 'level';

export const NPC_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  id: { col: 'id', defaultDir: 'asc' },
};
export const NPC_ORDER_DEFAULT = 'name';

export const MAP_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  streetName: { col: 'street_name', defaultDir: 'asc' },
  mobRate: { col: 'mob_rate', defaultDir: 'asc' },
  returnMapId: { col: 'return_map_id', defaultDir: 'asc' },
  id: { col: 'id', defaultDir: 'asc' },
};
export const MAP_ORDER_DEFAULT = 'name';

export const QUEST_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  parent: { col: 'parent', defaultDir: 'asc' },
  requiredLevel: { col: 'required_level', defaultDir: 'asc' },
  id: { col: 'id', defaultDir: 'asc' },
};
export const QUEST_ORDER_DEFAULT = 'name';

export function resolveOrder(
  allow: Record<string, OrderSpec>,
  fallbackKey: string,
  orderBy: string | undefined,
  dir: SortDir | undefined,
): { col: string; dir: SortDir } {
  const spec = (orderBy && allow[orderBy]) || allow[fallbackKey];
  return { col: spec.col, dir: dir === 'desc' || dir === 'asc' ? dir : spec.defaultDir };
}

export function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), 500);
}

export function clampOffset(offset: number | undefined): number {
  return Math.max(offset ?? 0, 0);
}
