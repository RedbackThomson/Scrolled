import type { Sqlite } from '../sqlite';
import type { ItemRecord, ListOptsBase, PageResult } from '../types';
import {
  ITEM_ORDER,
  ITEM_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { ITEM_FILTER, applyFilters } from './shared/filters';
import { rowToItem, type ItemRow } from './shared/rowMappers';

export function upsertItemRow(sql: Sqlite, item: ItemRecord): void {
  sql.exec(
    `INSERT INTO items (
      id, name, description, category, subcategory, icon_path, icon_data,
      price, stack_size, required_level,
      cash, trade_block, account_sharable, only_one, quest_item,
      time_limited, expire_on_logout, pickup_block, not_sale, drop_block, trade_available,
      source_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name           = excluded.name,
      description    = excluded.description,
      category       = excluded.category,
      subcategory    = excluded.subcategory,
      icon_path      = excluded.icon_path,
      -- Preserve an existing icon if the new record didn't bring fresh
      -- bytes (e.g. an extraction re-run without WZ files loaded).
      icon_data      = COALESCE(excluded.icon_data, items.icon_data),
      price          = excluded.price,
      stack_size     = excluded.stack_size,
      required_level = excluded.required_level,
      cash              = excluded.cash,
      trade_block       = excluded.trade_block,
      account_sharable  = excluded.account_sharable,
      only_one          = excluded.only_one,
      quest_item        = excluded.quest_item,
      time_limited      = excluded.time_limited,
      expire_on_logout  = excluded.expire_on_logout,
      pickup_block      = excluded.pickup_block,
      not_sale          = excluded.not_sale,
      drop_block        = excluded.drop_block,
      trade_available   = excluded.trade_available,
      source_path    = excluded.source_path`,
    [
      item.id,
      item.name,
      item.description,
      item.category,
      item.subcategory,
      item.iconPath,
      item.iconData,
      item.price,
      item.stackSize,
      item.requiredLevel,
      item.cash ? 1 : 0,
      item.tradeBlock ? 1 : 0,
      item.accountSharable ? 1 : 0,
      item.only ? 1 : 0,
      item.quest ? 1 : 0,
      item.timeLimited ? 1 : 0,
      item.expireOnLogout ? 1 : 0,
      item.pickupBlock ? 1 : 0,
      item.notSale ? 1 : 0,
      item.dropBlock ? 1 : 0,
      item.tradeAvailable ? 1 : 0,
      item.sourcePath,
    ],
  );
}

export function upsertItem(sql: Sqlite, item: ItemRecord): void {
  upsertItemRow(sql, item);
}

export function upsertItems(sql: Sqlite, items: ItemRecord[]): number {
  sql.transaction(() => {
    for (const item of items) upsertItemRow(sql, item);
  });
  return items.length;
}

export function getItem(sql: Sqlite, id: number): ItemRecord | null {
  const row = sql.selectObject<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
  return row ? rowToItem(row) : null;
}

export function getItemIcon(sql: Sqlite, id: number): Uint8Array | null {
  const row = sql.selectObject<{ icon_data: Uint8Array | null }>(
    'SELECT icon_data FROM items WHERE id = ?',
    [id],
  );
  return row?.icon_data ?? null;
}

export function listItems(
  sql: Sqlite,
  opts: ListOptsBase & { category?: string } = {},
): PageResult<ItemRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(ITEM_ORDER, ITEM_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${opts.search.trim()}%`);
  }
  if (opts.category) {
    where.push('category = ?');
    params.push(opts.category);
  }
  applyFilters(ITEM_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  // List queries deliberately skip `icon_data` — the BLOB lookup happens
  // per-icon via `getItemIcon(id)` so we don't drag MBs of bytes into a
  // list-render result.
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM items ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<ItemRow>(
        `SELECT id, name, description, category, subcategory, icon_path, NULL AS icon_data,
                price, stack_size, required_level,
                cash, trade_block, account_sharable, only_one, quest_item,
                time_limited, expire_on_logout, pickup_block, not_sale, drop_block, trade_available,
                source_path
         FROM items ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToItem);
    return { rows, total };
  });
}

export function listItemCategories(sql: Sqlite): string[] {
  return sql
    .selectObjects<{ category: string | null }>(
      `SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category <> '' ORDER BY category`,
    )
    .map((r) => r.category!)
    .filter((c): c is string => !!c);
}
