import type { Sqlite } from '../sqlite';
import type { EquipRecord, ListOptsBase, PageResult } from '../types';
import {
  EQUIP_ORDER,
  EQUIP_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { EQUIP_FILTER, applyFilters } from './shared/filters';
import { rowToEquip, type EquipRow } from './shared/rowMappers';

export function upsertEquipRow(sql: Sqlite, e: EquipRecord): void {
  sql.exec(
    `INSERT INTO equips (
      id, name, description, slot, category, required_level,
      required_str, required_dex, required_int, required_luk, required_job,
      attack, magic_attack, defense, magic_defense, accuracy, avoidability,
      upgrade_slots, inc_str, inc_dex, inc_int, inc_luk, inc_hp, inc_mp,
      inc_speed, inc_jump, cash, equip_type,
      trade_block, equip_trade_block, account_sharable, only_one, quest_item,
      time_limited, expire_on_logout, pickup_block, not_sale,
      icon_path, icon_data, source_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name           = excluded.name,
      description    = excluded.description,
      slot           = excluded.slot,
      category       = excluded.category,
      required_level = excluded.required_level,
      required_str   = excluded.required_str,
      required_dex   = excluded.required_dex,
      required_int   = excluded.required_int,
      required_luk   = excluded.required_luk,
      required_job   = excluded.required_job,
      attack         = excluded.attack,
      magic_attack   = excluded.magic_attack,
      defense        = excluded.defense,
      magic_defense  = excluded.magic_defense,
      accuracy       = excluded.accuracy,
      avoidability   = excluded.avoidability,
      upgrade_slots  = excluded.upgrade_slots,
      inc_str        = excluded.inc_str,
      inc_dex        = excluded.inc_dex,
      inc_int        = excluded.inc_int,
      inc_luk        = excluded.inc_luk,
      inc_hp         = excluded.inc_hp,
      inc_mp         = excluded.inc_mp,
      inc_speed      = excluded.inc_speed,
      inc_jump       = excluded.inc_jump,
      cash              = excluded.cash,
      equip_type        = excluded.equip_type,
      trade_block       = excluded.trade_block,
      equip_trade_block = excluded.equip_trade_block,
      account_sharable  = excluded.account_sharable,
      only_one          = excluded.only_one,
      quest_item        = excluded.quest_item,
      time_limited      = excluded.time_limited,
      expire_on_logout  = excluded.expire_on_logout,
      pickup_block      = excluded.pickup_block,
      not_sale          = excluded.not_sale,
      icon_path      = excluded.icon_path,
      icon_data      = COALESCE(excluded.icon_data, equips.icon_data),
      source_path    = excluded.source_path`,
    [
      e.id,
      e.name,
      e.description,
      e.slot,
      e.category,
      e.requiredLevel,
      e.requiredStr,
      e.requiredDex,
      e.requiredInt,
      e.requiredLuk,
      e.requiredJob,
      e.attack,
      e.magicAttack,
      e.defense,
      e.magicDefense,
      e.accuracy,
      e.avoidability,
      e.upgradeSlots,
      e.incStr,
      e.incDex,
      e.incInt,
      e.incLuk,
      e.incHp,
      e.incMp,
      e.incSpeed,
      e.incJump,
      e.cash ? 1 : 0,
      e.equipType,
      e.tradeBlock ? 1 : 0,
      e.equipTradeBlock ? 1 : 0,
      e.accountSharable ? 1 : 0,
      e.only ? 1 : 0,
      e.quest ? 1 : 0,
      e.timeLimited ? 1 : 0,
      e.expireOnLogout ? 1 : 0,
      e.pickupBlock ? 1 : 0,
      e.notSale ? 1 : 0,
      e.iconPath,
      e.iconData,
      e.sourcePath,
    ],
  );
}

export function upsertEquip(sql: Sqlite, equip: EquipRecord): void {
  upsertEquipRow(sql, equip);
}

export function upsertEquips(sql: Sqlite, equips: EquipRecord[]): number {
  sql.transaction(() => {
    for (const e of equips) upsertEquipRow(sql, e);
  });
  return equips.length;
}

export function getEquip(sql: Sqlite, id: number): EquipRecord | null {
  const row = sql.selectObject<EquipRow>('SELECT * FROM equips WHERE id = ?', [id]);
  return row ? rowToEquip(row) : null;
}

export function getEquipIcon(sql: Sqlite, id: number): Uint8Array | null {
  const row = sql.selectObject<{ icon_data: Uint8Array | null }>(
    'SELECT icon_data FROM equips WHERE id = ?',
    [id],
  );
  return row?.icon_data ?? null;
}

export function listEquips(
  sql: Sqlite,
  opts: ListOptsBase & { slot?: string; kind?: 'equip' | 'weapon' } = {},
): PageResult<EquipRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(EQUIP_ORDER, EQUIP_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${opts.search.trim()}%`);
  }
  if (opts.slot) {
    where.push('slot = ?');
    params.push(opts.slot);
  }
  if (opts.kind === 'weapon') {
    where.push('equip_type IS NOT NULL');
  } else if (opts.kind === 'equip') {
    where.push('equip_type IS NULL');
  }
  applyFilters(EQUIP_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM equips ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<EquipRow>(
        `SELECT id, name, description, slot, category, required_level,
                required_str, required_dex, required_int, required_luk, required_job,
                attack, magic_attack, defense, magic_defense, accuracy, avoidability,
                upgrade_slots, inc_str, inc_dex, inc_int, inc_luk, inc_hp, inc_mp,
                inc_speed, inc_jump, cash, equip_type,
                trade_block, equip_trade_block, account_sharable, only_one, quest_item,
                time_limited, expire_on_logout, pickup_block, not_sale,
                icon_path, NULL AS icon_data, source_path
         FROM equips ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToEquip);
    return { rows, total };
  });
}

export function listEquipSlots(sql: Sqlite): string[] {
  return sql
    .selectObjects<{ slot: string | null }>(
      `SELECT DISTINCT slot FROM equips WHERE slot IS NOT NULL ORDER BY slot`,
    )
    .map((r) => r.slot!)
    .filter((s): s is string => !!s);
}

export function listEquipTypes(sql: Sqlite): string[] {
  return sql
    .selectObjects<{ equip_type: string | null }>(
      `SELECT DISTINCT equip_type FROM equips
       WHERE equip_type IS NOT NULL AND equip_type <> ''
       ORDER BY equip_type`,
    )
    .map((r) => r.equip_type!)
    .filter((s): s is string => !!s);
}
