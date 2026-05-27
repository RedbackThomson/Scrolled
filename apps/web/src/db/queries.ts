// Domain query helpers built on top of the thin `Sqlite` wrapper.

import { CURRENT_DATA_REVISION, MINIMUM_SUPPORTED_DATA_REVISION } from './dataVersion';
import type { Sqlite, Row, PreMigrateContext } from './sqlite';
import type {
  DatasetFileRef,
  DatasetRecord,
  DbStatus,
  EntityKind,
  EntitySummary,
  ExtractorResultRecord,
  EquipRecord,
  ItemRecord,
  ListOptsBase,
  MapMobRecord,
  MapMobSpawnRecord,
  MapMobSpawnWithName,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapPortalWithName,
  MapRecord,
  MobDropRecord,
  MobDropWithName,
  MobMapAppearance,
  MobRecord,
  NpcRecord,
  GameDatabase,
  PageResult,
  QuestRecord,
  QuestRequirementRecord,
  QuestRequirementWithName,
  QuestRewardRecord,
  QuestRewardWithName,
  QuestSummary,
  SearchEntry,
} from './types';
import { ENTITY_TABLES } from './queries/shared/tables';
import {
  EQUIP_ORDER,
  EQUIP_ORDER_DEFAULT,
  ITEM_ORDER,
  ITEM_ORDER_DEFAULT,
  MAP_ORDER,
  MAP_ORDER_DEFAULT,
  MOB_ORDER,
  MOB_ORDER_DEFAULT,
  NPC_ORDER,
  NPC_ORDER_DEFAULT,
  QUEST_ORDER,
  QUEST_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './queries/shared/order';
import {
  EQUIP_FILTER,
  ITEM_FILTER,
  MAP_FILTER,
  MOB_FILTER,
  NPC_FILTER,
  QUEST_FILTER,
  applyFilters,
} from './queries/shared/filters';
import {
  rowToEquip,
  rowToItem,
  rowToMap,
  rowToMob,
  rowToNpc,
  rowToQuest,
  type EquipRow,
  type ItemRow,
  type MapRow,
  type MobRow,
  type NpcRow,
  type QuestRow,
} from './queries/shared/rowMappers';

/**
 * Pre-migration destructive-reset decision for the game cache. Passed to
 * `Sqlite` as `resetBeforeMigrate`. If the stored data revision is below the
 * minimum this build can read and the library actually has data, clear it so
 * the breaking migration that follows applies to empty tables. A fresh DB
 * (no data) is a genuine first run and left alone. Reads defensively because
 * `app_meta` may not exist yet on a pre-tracking database.
 */
export function gameDataPreMigrateReset(ctx: PreMigrateContext): boolean {
  const hasMeta =
    ctx.selectValue("SELECT 1 FROM sqlite_master WHERE type='table' AND name='app_meta'") != null;
  const revision = hasMeta
    ? Number(
        ctx.selectValue<string>("SELECT value FROM app_meta WHERE key = 'data_revision'") ?? 0,
      ) || 0
    : 0;
  if (revision >= MINIMUM_SUPPORTED_DATA_REVISION) return false;
  if (!ctx.hasAnyUserData()) return false;
  ctx.clearAllUserData();
  return true;
}

export class DbApi implements GameDatabase {
  constructor(private readonly sql: Sqlite) {}

  async open(): Promise<DbStatus> {
    const result = await this.sql.open();
    if (result.didDestructiveReset) this.markPendingRebuild();
    return this.status();
  }

  private getMeta(key: string): string | null {
    const v = this.sql.selectValue('SELECT value FROM app_meta WHERE key = ?', [key]);
    return typeof v === 'string' ? v : null;
  }

  private setMeta(key: string, value: string): void {
    this.sql.exec('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)', [key, value]);
  }

  private deleteMeta(key: string): void {
    this.sql.exec('DELETE FROM app_meta WHERE key = ?', [key]);
  }

  private markPendingRebuild(): void {
    this.setMeta('pending_rebuild', '1');
  }

  async status(): Promise<DbStatus> {
    const schemaVersion = Number(this.sql.selectValue('SELECT MAX(version) FROM _migrations') ?? 0);
    // A missing/non-numeric key reads as 0 — below the minimum supported
    // revision, so a pre-tracking database is flagged for reinitialization.
    const dataRevision = Number(this.getMeta('data_revision') ?? 0) || 0;
    // Set when open()/importBytes destructively cleared an incompatible cache.
    // Distinguishes "library was wiped, must rebuild" from a genuine first run,
    // since both leave empty tables. Cleared by the next successful run.
    const pendingRebuild = this.getMeta('pending_rebuild') === '1';
    return {
      schemaVersion,
      dataRevision,
      pendingRebuild,
      backend: this.sql.backend,
      fallbackReason: this.sql.fallbackReason,
      counts: {
        items: this.countOf('items'),
        equips: this.countOf('equips'),
        mobs: this.countOf('mobs'),
        npcs: this.countOf('npcs'),
        maps: this.countOf('maps'),
        quests: this.countOf('quests'),
        datasets: this.countOf('datasets'),
      },
    };
  }

  async upsertItem(item: ItemRecord): Promise<void> {
    this.upsertItemRow(item);
  }

  async upsertItems(items: ItemRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const item of items) this.upsertItemRow(item);
    });
    return items.length;
  }

  async getItem(id: number): Promise<ItemRecord | null> {
    const row = this.sql.selectObject<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
    return row ? rowToItem(row) : null;
  }

  async getItemIcon(id: number): Promise<Uint8Array | null> {
    const row = this.sql.selectObject<{ icon_data: Uint8Array | null }>(
      'SELECT icon_data FROM items WHERE id = ?',
      [id],
    );
    return row?.icon_data ?? null;
  }

  async listItems(
    opts: ListOptsBase & { category?: string } = {},
  ): Promise<PageResult<ItemRecord>> {
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
    return this.sql.transaction(() => {
      const total = Number(
        this.sql.selectValue(
          `SELECT COUNT(*) FROM items ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
      const rows = this.sql
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

  async upsertEquip(equip: EquipRecord): Promise<void> {
    this.upsertEquipRow(equip);
  }

  async upsertEquips(equips: EquipRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const e of equips) this.upsertEquipRow(e);
    });
    return equips.length;
  }

  async getEquip(id: number): Promise<EquipRecord | null> {
    const row = this.sql.selectObject<EquipRow>('SELECT * FROM equips WHERE id = ?', [id]);
    return row ? rowToEquip(row) : null;
  }

  async getEquipIcon(id: number): Promise<Uint8Array | null> {
    const row = this.sql.selectObject<{ icon_data: Uint8Array | null }>(
      'SELECT icon_data FROM equips WHERE id = ?',
      [id],
    );
    return row?.icon_data ?? null;
  }

  async listEquips(
    opts: ListOptsBase & { slot?: string; kind?: 'equip' | 'weapon' } = {},
  ): Promise<PageResult<EquipRecord>> {
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
    return this.sql.transaction(() => {
      const total = Number(
        this.sql.selectValue(
          `SELECT COUNT(*) FROM equips ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
      const rows = this.sql
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

  async listEquipSlots(): Promise<string[]> {
    return this.sql
      .selectObjects<{ slot: string | null }>(
        `SELECT DISTINCT slot FROM equips WHERE slot IS NOT NULL ORDER BY slot`,
      )
      .map((r) => r.slot!)
      .filter((s): s is string => !!s);
  }

  async listEquipTypes(): Promise<string[]> {
    return this.sql
      .selectObjects<{ equip_type: string | null }>(
        `SELECT DISTINCT equip_type FROM equips
         WHERE equip_type IS NOT NULL AND equip_type <> ''
         ORDER BY equip_type`,
      )
      .map((r) => r.equip_type!)
      .filter((s): s is string => !!s);
  }

  async listItemCategories(): Promise<string[]> {
    return this.sql
      .selectObjects<{ category: string | null }>(
        `SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND category <> '' ORDER BY category`,
      )
      .map((r) => r.category!)
      .filter((c): c is string => !!c);
  }

  async upsertMobs(mobs: MobRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const m of mobs) {
        this.sql.exec(
          `INSERT INTO mobs (
            id, name, level, hp, mp, exp, is_boss,
            element_attack, element_defenses_json, icon_path, icon_data, source_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name                  = excluded.name,
            level                 = excluded.level,
            hp                    = excluded.hp,
            mp                    = excluded.mp,
            exp                   = excluded.exp,
            is_boss               = excluded.is_boss,
            element_attack        = excluded.element_attack,
            element_defenses_json = excluded.element_defenses_json,
            icon_path             = excluded.icon_path,
            -- Preserve a previously-decoded icon when this run produced
            -- none (e.g. transient decode failure on one mob).
            icon_data             = COALESCE(excluded.icon_data, mobs.icon_data),
            source_path           = excluded.source_path`,
          [
            m.id,
            m.name,
            m.level,
            m.hp,
            m.mp,
            m.exp,
            m.isBoss ? 1 : 0,
            m.elementAttack,
            m.elementDefensesJson,
            m.iconPath,
            m.iconData,
            m.sourcePath,
          ],
        );
      }
    });
    return mobs.length;
  }

  async getMobIcon(id: number): Promise<Uint8Array | null> {
    const row = this.sql.selectObject<{ icon_data: Uint8Array | null }>(
      'SELECT icon_data FROM mobs WHERE id = ?',
      [id],
    );
    return row?.icon_data ?? null;
  }

  async getMob(id: number): Promise<MobRecord | null> {
    const row = this.sql.selectObject<MobRow>('SELECT * FROM mobs WHERE id = ?', [id]);
    return row ? rowToMob(row) : null;
  }

  async listMobs(opts: ListOptsBase = {}): Promise<PageResult<MobRecord>> {
    const limit = clampLimit(opts.limit);
    const offset = clampOffset(opts.offset);
    const order = resolveOrder(MOB_ORDER, MOB_ORDER_DEFAULT, opts.orderBy, opts.dir);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    applyFilters(MOB_FILTER, opts.filters, where, params);
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    // Skip icon_data — fetched separately via getMobIcon for the rows
    // the UI ends up rendering, so we don't drag MBs into every list call.
    return this.sql.transaction(() => {
      const total = Number(
        this.sql.selectValue(
          `SELECT COUNT(*) FROM mobs ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
      const rows = this.sql
        .selectObjects<MobRow>(
          `SELECT id, name, level, hp, mp, exp, is_boss, element_attack,
                  element_defenses_json, icon_path, NULL AS icon_data, source_path
           FROM mobs ${clause}
           ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        )
        .map(rowToMob);
      return { rows, total };
    });
  }

  async getMobDrops(mobId: number): Promise<MobDropWithName[]> {
    // item_id can match either items.id or equips.id; coalesce a single
    // name + entity kind so the UI can route the link to the right page.
    return this.sql
      .selectObjects<{
        mob_id: number;
        item_id: number;
        item_name: string | null;
        equip_name: string | null;
      }>(
        `SELECT d.mob_id, d.item_id, i.name AS item_name, e.name AS equip_name
         FROM mob_drops d
         LEFT JOIN items  i ON i.id = d.item_id
         LEFT JOIN equips e ON e.id = d.item_id
         WHERE d.mob_id = ?
         ORDER BY COALESCE(i.name, e.name) NULLS LAST, d.item_id`,
        [mobId],
      )
      .map((r) => ({
        mobId: r.mob_id,
        itemId: r.item_id,
        itemName: r.item_name ?? r.equip_name,
        entity: r.item_name ? 'item' : r.equip_name ? 'equip' : null,
      }));
  }

  async getItemDroppedBy(
    itemId: number,
  ): Promise<{ mobId: number; name: string; level: number | null }[]> {
    return this.sql
      .selectObjects<{ mob_id: number; name: string; level: number | null }>(
        `SELECT d.mob_id, m.name, m.level
         FROM mob_drops d INNER JOIN mobs m ON m.id = d.mob_id
         WHERE d.item_id = ?
         ORDER BY m.level NULLS LAST, m.name`,
        [itemId],
      )
      .map((r) => ({ mobId: r.mob_id, name: r.name, level: r.level }));
  }

  async getMobMaps(mobId: number): Promise<MobMapAppearance[]> {
    return this.sql
      .selectObjects<MapRow & { spawn_count: number | null }>(
        `SELECT m.id, m.name, m.street_name, m.return_map_id, m.forced_return_map_id,
                m.field_limit, m.mob_rate, m.minimap_path, NULL AS minimap_data,
                m.minimap_center_x, m.minimap_center_y, m.minimap_width, m.minimap_height,
                m.minimap_mag, m.source_path,
                mm.count AS spawn_count
         FROM maps m
         JOIN map_mobs mm ON mm.map_id = m.id
         WHERE mm.mob_id = ?
         ORDER BY m.name`,
        [mobId],
      )
      .map((r) => ({ ...rowToMap(r), spawnCount: r.spawn_count }));
  }

  async replaceMobDrops(drops: MobDropRecord[]): Promise<void> {
    // Collect distinct mob IDs so we delete their prior drop rows before
    // reinserting; mirrors `replaceMapLife`'s approach.
    const mobIds = new Set<number>();
    for (const d of drops) mobIds.add(d.mobId);
    this.sql.transaction(() => {
      for (const id of mobIds) {
        this.sql.exec('DELETE FROM mob_drops WHERE mob_id = ?', [id]);
      }
      for (const d of drops) {
        this.sql.exec('INSERT OR REPLACE INTO mob_drops (mob_id, item_id) VALUES (?, ?)', [
          d.mobId,
          d.itemId,
        ]);
      }
    });
  }

  async upsertNpcs(npcs: NpcRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const n of npcs) {
        this.sql.exec(
          `INSERT INTO npcs (id, name, description, icon_path, icon_data, source_path)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name        = excluded.name,
             description = excluded.description,
             icon_path   = excluded.icon_path,
             icon_data   = COALESCE(excluded.icon_data, npcs.icon_data),
             source_path = excluded.source_path`,
          [n.id, n.name, n.description, n.iconPath, n.iconData, n.sourcePath],
        );
      }
    });
    return npcs.length;
  }

  async getNpc(id: number): Promise<NpcRecord | null> {
    const row = this.sql.selectObject<NpcRow>('SELECT * FROM npcs WHERE id = ?', [id]);
    return row ? rowToNpc(row) : null;
  }

  async getNpcIcon(id: number): Promise<Uint8Array | null> {
    const row = this.sql.selectObject<{ icon_data: Uint8Array | null }>(
      'SELECT icon_data FROM npcs WHERE id = ?',
      [id],
    );
    return row?.icon_data ?? null;
  }

  async listNpcs(opts: ListOptsBase = {}): Promise<PageResult<NpcRecord>> {
    const limit = clampLimit(opts.limit);
    const offset = clampOffset(opts.offset);
    const order = resolveOrder(NPC_ORDER, NPC_ORDER_DEFAULT, opts.orderBy, opts.dir);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    applyFilters(NPC_FILTER, opts.filters, where, params);
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return this.sql.transaction(() => {
      const total = Number(
        this.sql.selectValue(
          `SELECT COUNT(*) FROM npcs ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
      const rows = this.sql
        .selectObjects<NpcRow>(
          `SELECT id, name, description, icon_path, NULL AS icon_data, source_path
           FROM npcs ${clause}
           ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        )
        .map(rowToNpc);
      return { rows, total };
    });
  }

  async getNpcMaps(npcId: number): Promise<MapRecord[]> {
    return this.sql
      .selectObjects<MapRow>(
        `SELECT DISTINCT m.id, m.name, m.street_name, m.return_map_id, m.forced_return_map_id,
                m.field_limit, m.mob_rate, m.minimap_path, NULL AS minimap_data,
                m.minimap_center_x, m.minimap_center_y, m.minimap_width, m.minimap_height,
                m.minimap_mag, m.source_path
         FROM maps m
         JOIN map_npcs mn ON mn.map_id = m.id
         WHERE mn.npc_id = ?
         ORDER BY m.name`,
        [npcId],
      )
      .map(rowToMap);
  }

  async upsertMaps(maps: MapRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const m of maps) {
        this.sql.exec(
          `INSERT INTO maps (
            id, name, street_name, return_map_id, forced_return_map_id,
            field_limit, mob_rate, minimap_path, minimap_data,
            minimap_center_x, minimap_center_y, minimap_width, minimap_height,
            minimap_mag, source_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name                 = excluded.name,
            street_name          = excluded.street_name,
            return_map_id        = excluded.return_map_id,
            forced_return_map_id = excluded.forced_return_map_id,
            field_limit          = excluded.field_limit,
            mob_rate             = excluded.mob_rate,
            minimap_path         = excluded.minimap_path,
            minimap_data         = COALESCE(excluded.minimap_data, maps.minimap_data),
            minimap_center_x     = COALESCE(excluded.minimap_center_x, maps.minimap_center_x),
            minimap_center_y     = COALESCE(excluded.minimap_center_y, maps.minimap_center_y),
            minimap_width        = COALESCE(excluded.minimap_width, maps.minimap_width),
            minimap_height       = COALESCE(excluded.minimap_height, maps.minimap_height),
            minimap_mag          = COALESCE(excluded.minimap_mag, maps.minimap_mag),
            source_path          = excluded.source_path`,
          [
            m.id,
            m.name,
            m.streetName,
            m.returnMapId,
            m.forcedReturnMapId,
            m.fieldLimit,
            m.mobRate,
            m.minimapPath,
            m.minimapData,
            m.minimapCenterX,
            m.minimapCenterY,
            m.minimapWidth,
            m.minimapHeight,
            m.minimapMag,
            m.sourcePath,
          ],
        );
      }
    });
    return maps.length;
  }

  async getMap(id: number): Promise<MapRecord | null> {
    const row = this.sql.selectObject<MapRow>('SELECT * FROM maps WHERE id = ?', [id]);
    return row ? rowToMap(row) : null;
  }

  async getMapMinimap(id: number): Promise<Uint8Array | null> {
    const row = this.sql.selectObject<{ minimap_data: Uint8Array | null }>(
      'SELECT minimap_data FROM maps WHERE id = ?',
      [id],
    );
    return row?.minimap_data ?? null;
  }

  async listMaps(opts: ListOptsBase = {}): Promise<PageResult<MapRecord>> {
    const limit = clampLimit(opts.limit);
    const offset = clampOffset(opts.offset);
    const order = resolveOrder(MAP_ORDER, MAP_ORDER_DEFAULT, opts.orderBy, opts.dir);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('(name LIKE ? OR street_name LIKE ?)');
      const q = `%${opts.search.trim()}%`;
      params.push(q, q);
    }
    applyFilters(MAP_FILTER, opts.filters, where, params);
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return this.sql.transaction(() => {
      const total = Number(
        this.sql.selectValue(
          `SELECT COUNT(*) FROM maps ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
      const rows = this.sql
        .selectObjects<MapRow>(
          `SELECT id, name, street_name, return_map_id, forced_return_map_id,
                  field_limit, mob_rate, minimap_path, NULL AS minimap_data,
                  minimap_center_x, minimap_center_y, minimap_width, minimap_height,
                  minimap_mag, source_path
           FROM maps ${clause}
           ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        )
        .map(rowToMap);
      return { rows, total };
    });
  }

  async getMapNpcs(mapId: number): Promise<MapNpcWithName[]> {
    return this.sql.selectObjects<MapNpcWithName & Row>(
      `SELECT mn.map_id AS mapId, mn.npc_id AS npcId, mn.x, mn.y, n.name
       FROM map_npcs mn LEFT JOIN npcs n ON n.id = mn.npc_id
       WHERE mn.map_id = ?
       ORDER BY n.name`,
      [mapId],
    );
  }

  async getMapMobs(mapId: number): Promise<MapMobWithName[]> {
    return this.sql.selectObjects<MapMobWithName & Row>(
      `SELECT mm.map_id AS mapId, mm.mob_id AS mobId, mm.count, m.name, m.level
       FROM map_mobs mm LEFT JOIN mobs m ON m.id = mm.mob_id
       WHERE mm.map_id = ?
       ORDER BY m.level NULLS LAST, m.name`,
      [mapId],
    );
  }

  async getMapPortals(mapId: number): Promise<MapPortalWithName[]> {
    return this.sql
      .selectObjects<{
        map_id: number;
        idx: number;
        portal_name: string;
        target_map_id: number | null;
        target_portal: string | null;
        x: number | null;
        y: number | null;
        portal_type: number | null;
        script: string | null;
        target_map_name: string | null;
      }>(
        `SELECT mp.map_id, mp.idx, mp.portal_name, mp.target_map_id, mp.target_portal,
                mp.x, mp.y, mp.portal_type, mp.script, tm.name AS target_map_name
         FROM map_portals mp
         LEFT JOIN maps tm ON tm.id = mp.target_map_id
         WHERE mp.map_id = ?
         ORDER BY mp.idx`,
        [mapId],
      )
      .map((r) => ({
        mapId: r.map_id,
        idx: r.idx,
        portalName: r.portal_name,
        targetMapId: r.target_map_id,
        targetPortal: r.target_portal,
        x: r.x,
        y: r.y,
        portalType: r.portal_type,
        script: r.script,
        targetMapName: r.target_map_name,
      }));
  }

  async getMapMobSpawns(mapId: number): Promise<MapMobSpawnWithName[]> {
    return this.sql.selectObjects<MapMobSpawnWithName & Row>(
      `SELECT ms.map_id AS mapId, ms.mob_id AS mobId, ms.x, ms.y, m.name, m.level
       FROM map_mob_spawns ms LEFT JOIN mobs m ON m.id = ms.mob_id
       WHERE ms.map_id = ?
       ORDER BY m.level NULLS LAST, m.name`,
      [mapId],
    );
  }

  async replaceMapLife(rows: {
    npcs: MapNpcRecord[];
    mobs: MapMobRecord[];
    portals: MapPortalRecord[];
    mobSpawns: MapMobSpawnRecord[];
  }): Promise<void> {
    // Collect distinct map IDs across every table so we wipe their previous
    // rows before reinserting. Avoids stale entries when a map is
    // re-extracted with different NPC/mob/portal sets.
    const mapIds = new Set<number>();
    for (const r of rows.npcs) mapIds.add(r.mapId);
    for (const r of rows.mobs) mapIds.add(r.mapId);
    for (const r of rows.portals) mapIds.add(r.mapId);
    for (const r of rows.mobSpawns) mapIds.add(r.mapId);
    this.sql.transaction(() => {
      for (const id of mapIds) {
        this.sql.exec('DELETE FROM map_npcs        WHERE map_id = ?', [id]);
        this.sql.exec('DELETE FROM map_mobs        WHERE map_id = ?', [id]);
        this.sql.exec('DELETE FROM map_portals     WHERE map_id = ?', [id]);
        this.sql.exec('DELETE FROM map_mob_spawns  WHERE map_id = ?', [id]);
      }
      for (const r of rows.npcs) {
        this.sql.exec(
          'INSERT OR REPLACE INTO map_npcs (map_id, npc_id, x, y) VALUES (?, ?, ?, ?)',
          [r.mapId, r.npcId, r.x, r.y],
        );
      }
      for (const r of rows.mobs) {
        this.sql.exec('INSERT OR REPLACE INTO map_mobs (map_id, mob_id, count) VALUES (?, ?, ?)', [
          r.mapId,
          r.mobId,
          r.count,
        ]);
      }
      for (const r of rows.portals) {
        this.sql.exec(
          `INSERT OR REPLACE INTO map_portals (map_id, idx, portal_name, target_map_id, target_portal, x, y, portal_type, script)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.mapId,
            r.idx,
            r.portalName,
            r.targetMapId,
            r.targetPortal,
            r.x,
            r.y,
            r.portalType,
            r.script,
          ],
        );
      }
      for (const r of rows.mobSpawns) {
        this.sql.exec('INSERT INTO map_mob_spawns (map_id, mob_id, x, y) VALUES (?, ?, ?, ?)', [
          r.mapId,
          r.mobId,
          r.x,
          r.y,
        ]);
      }
    });
  }

  async upsertQuests(quests: QuestRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const q of quests) {
        this.sql.exec(
          `INSERT INTO quests (
            id, name, parent, description, start_npc_id, end_npc_id,
            required_level, required_job, source_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name           = excluded.name,
            parent         = excluded.parent,
            description    = excluded.description,
            start_npc_id   = excluded.start_npc_id,
            end_npc_id     = excluded.end_npc_id,
            required_level = excluded.required_level,
            required_job   = excluded.required_job,
            source_path    = excluded.source_path`,
          [
            q.id,
            q.name,
            q.parent,
            q.description,
            q.startNpcId,
            q.endNpcId,
            q.requiredLevel,
            q.requiredJob,
            q.sourcePath,
          ],
        );
      }
    });
    return quests.length;
  }

  async getQuest(id: number): Promise<QuestRecord | null> {
    const row = this.sql.selectObject<QuestRow>('SELECT * FROM quests WHERE id = ?', [id]);
    return row ? rowToQuest(row) : null;
  }

  async listQuests(
    opts: ListOptsBase & { parent?: string } = {},
  ): Promise<PageResult<QuestRecord>> {
    const limit = clampLimit(opts.limit);
    const offset = clampOffset(opts.offset);
    const order = resolveOrder(QUEST_ORDER, QUEST_ORDER_DEFAULT, opts.orderBy, opts.dir);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    if (opts.parent) {
      where.push('parent = ?');
      params.push(opts.parent);
    }
    applyFilters(QUEST_FILTER, opts.filters, where, params);
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    return this.sql.transaction(() => {
      const total = Number(
        this.sql.selectValue(
          `SELECT COUNT(*) FROM quests ${clause}`,
          params.length > 0 ? params : undefined,
        ) ?? 0,
      );
      const rows = this.sql
        .selectObjects<QuestRow>(
          `SELECT * FROM quests ${clause}
           ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
           LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        )
        .map(rowToQuest);
      return { rows, total };
    });
  }

  async listQuestParents(): Promise<string[]> {
    return this.sql
      .selectObjects<{
        parent: string;
      }>(
        `SELECT DISTINCT parent FROM quests WHERE parent IS NOT NULL AND parent <> '' ORDER BY parent`,
      )
      .map((r) => r.parent);
  }

  async getQuestRequirements(questId: number): Promise<QuestRequirementWithName[]> {
    // The display name comes from whichever side of the union the kind points
    // at. We compute it inline with CASE so the result is a single homogenous
    // result set the caller can render directly.
    return this.sql
      .selectObjects<{
        quest_id: number;
        kind: QuestRequirementRecord['kind'];
        target_id: number | null;
        amount: number | null;
        target_name: string | null;
      }>(
        `SELECT
           qr.quest_id, qr.kind, qr.target_id, qr.amount,
           CASE qr.kind
             WHEN 'item' THEN COALESCE(i.name, e.name)
             WHEN 'mob'  THEN m.name
             WHEN 'questPre' THEN q.name
             ELSE NULL
           END AS target_name
         FROM quest_requirements qr
         LEFT JOIN items  i ON qr.kind = 'item'     AND i.id = qr.target_id
         LEFT JOIN equips e ON qr.kind = 'item'     AND e.id = qr.target_id
         LEFT JOIN mobs   m ON qr.kind = 'mob'      AND m.id = qr.target_id
         LEFT JOIN quests q ON qr.kind = 'questPre' AND q.id = qr.target_id
         WHERE qr.quest_id = ?
         ORDER BY qr.kind, qr.target_id`,
        [questId],
      )
      .map((r) => ({
        questId: r.quest_id,
        kind: r.kind,
        targetId: r.target_id,
        amount: r.amount,
        targetName: r.target_name,
      }));
  }

  async getQuestRewards(questId: number): Promise<QuestRewardWithName[]> {
    return this.sql
      .selectObjects<{
        quest_id: number;
        kind: QuestRewardRecord['kind'];
        target_id: number | null;
        amount: number | null;
        target_name: string | null;
      }>(
        `SELECT
           qr.quest_id, qr.kind, qr.target_id, qr.amount,
           CASE qr.kind
             WHEN 'item' THEN COALESCE(i.name, e.name)
             ELSE NULL
           END AS target_name
         FROM quest_rewards qr
         LEFT JOIN items  i ON qr.kind = 'item' AND i.id = qr.target_id
         LEFT JOIN equips e ON qr.kind = 'item' AND e.id = qr.target_id
         WHERE qr.quest_id = ?
         ORDER BY qr.kind, qr.target_id`,
        [questId],
      )
      .map((r) => ({
        questId: r.quest_id,
        kind: r.kind,
        targetId: r.target_id,
        amount: r.amount,
        targetName: r.target_name,
      }));
  }

  async getNpcQuests(npcId: number): Promise<QuestSummary[]> {
    return this.sql
      .selectObjects<{ id: number; name: string; parent: string | null }>(
        `SELECT id, name, parent FROM quests
         WHERE start_npc_id = ? OR end_npc_id = ?
         ORDER BY parent NULLS LAST, name`,
        [npcId, npcId],
      )
      .map((r) => ({ id: r.id, name: r.name, parent: r.parent }));
  }

  async getItemQuests(itemId: number): Promise<QuestSummary[]> {
    return this.sql
      .selectObjects<{ id: number; name: string; parent: string | null }>(
        `SELECT DISTINCT q.id, q.name, q.parent
         FROM quests q
         JOIN quest_requirements qr ON qr.quest_id = q.id
         WHERE qr.kind = 'item' AND qr.target_id = ?
         ORDER BY q.parent NULLS LAST, q.name`,
        [itemId],
      )
      .map((r) => ({ id: r.id, name: r.name, parent: r.parent }));
  }

  async getMobQuests(mobId: number): Promise<QuestSummary[]> {
    return this.sql
      .selectObjects<{ id: number; name: string; parent: string | null }>(
        `SELECT DISTINCT q.id, q.name, q.parent
         FROM quests q
         JOIN quest_requirements qr ON qr.quest_id = q.id
         WHERE qr.kind = 'mob' AND qr.target_id = ?
         ORDER BY q.parent NULLS LAST, q.name`,
        [mobId],
      )
      .map((r) => ({ id: r.id, name: r.name, parent: r.parent }));
  }

  async replaceQuestRelations(rows: {
    requirements: QuestRequirementRecord[];
    rewards: QuestRewardRecord[];
  }): Promise<void> {
    // Wipe rows for every quest mentioned in either list so re-extracts
    // don't leave stale joins. Same pattern as replaceMapLife.
    const questIds = new Set<number>();
    for (const r of rows.requirements) questIds.add(r.questId);
    for (const r of rows.rewards) questIds.add(r.questId);
    this.sql.transaction(() => {
      for (const id of questIds) {
        this.sql.exec('DELETE FROM quest_requirements WHERE quest_id = ?', [id]);
        this.sql.exec('DELETE FROM quest_rewards      WHERE quest_id = ?', [id]);
      }
      for (const r of rows.requirements) {
        this.sql.exec(
          `INSERT OR REPLACE INTO quest_requirements (quest_id, kind, target_id, amount)
           VALUES (?, ?, ?, ?)`,
          [r.questId, r.kind, r.targetId, r.amount],
        );
      }
      for (const r of rows.rewards) {
        this.sql.exec(
          `INSERT OR REPLACE INTO quest_rewards (quest_id, kind, target_id, amount)
           VALUES (?, ?, ?, ?)`,
          [r.questId, r.kind, r.targetId, r.amount],
        );
      }
    });
  }

  async listSearchEntries(): Promise<SearchEntry[]> {
    const out: SearchEntry[] = [];
    for (const r of this.sql.selectObjects<{
      id: number;
      name: string;
      category: string | null;
    }>(`SELECT id, name, category FROM items`)) {
      out.push({ id: r.id, name: r.name, entity: 'item', category: r.category });
    }
    for (const r of this.sql.selectObjects<{
      id: number;
      name: string;
      slot: string | null;
    }>(`SELECT id, name, slot FROM equips`)) {
      out.push({ id: r.id, name: r.name, entity: 'equip', category: r.slot });
    }
    for (const r of this.sql.selectObjects<{
      id: number;
      name: string;
      level: number | null;
    }>(`SELECT id, name, level FROM mobs WHERE name IS NOT NULL AND name <> ''`)) {
      out.push({
        id: r.id,
        name: r.name,
        entity: 'mob',
        category: r.level !== null ? `Lv ${r.level}` : null,
      });
    }
    for (const r of this.sql.selectObjects<{ id: number; name: string }>(
      `SELECT id, name FROM npcs WHERE name IS NOT NULL AND name <> ''`,
    )) {
      out.push({ id: r.id, name: r.name, entity: 'npc', category: null });
    }
    for (const r of this.sql.selectObjects<{
      id: number;
      name: string | null;
      street_name: string | null;
    }>(`SELECT id, name, street_name FROM maps WHERE name IS NOT NULL AND name <> ''`)) {
      out.push({
        id: r.id,
        name: r.name ?? `Map ${r.id}`,
        entity: 'map',
        category: r.street_name,
      });
    }
    for (const r of this.sql.selectObjects<{
      id: number;
      name: string;
      parent: string | null;
    }>(`SELECT id, name, parent FROM quests WHERE name IS NOT NULL AND name <> ''`)) {
      out.push({ id: r.id, name: r.name, entity: 'quest', category: r.parent });
    }
    return out;
  }

  async recordDataset(input: {
    label: string;
    wzVersion: string;
    files: DatasetFileRef[];
    notes?: string;
    totalMs?: number;
    ok?: boolean;
    extractors?: ExtractorResultRecord[];
  }): Promise<DatasetRecord> {
    return this.sql.transaction(() => {
      this.sql.exec(
        `INSERT INTO datasets (label, loaded_at, wz_version, notes, total_ms, ok)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          input.label,
          Date.now(),
          input.wzVersion,
          input.notes ?? null,
          input.totalMs ?? null,
          input.ok === undefined ? null : input.ok ? 1 : 0,
        ],
      );
      const id = Number(this.sql.selectValue('SELECT last_insert_rowid()'));
      // INSERT OR REPLACE so we self-heal from any orphaned rows whose
      // dataset_id was recycled by AUTOINCREMENT after a `clearAllData`
      // that pre-dated the fix to also clear these child tables.
      for (const f of input.files) {
        this.sql.exec(
          `INSERT OR REPLACE INTO dataset_files
             (dataset_id, name, size, hash, load_status, load_error)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, f.name, f.size ?? null, f.hash ?? null, f.loadStatus ?? null, f.loadError ?? null],
        );
      }
      for (const e of input.extractors ?? []) {
        this.sql.exec(
          `INSERT OR REPLACE INTO extraction_extractors
             (dataset_id, extractor, status, rows, skipped_rows, placeholder_names, error)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, e.extractor, e.status, e.rows, e.skippedRows, e.placeholderNames, e.error ?? null],
        );
      }
      // A clean run stamps the library as produced by this build's data
      // contract and clears the rebuild flag, dismissing any "reinitialize /
      // re-index" prompt. A failed run leaves both untouched. See
      // db/dataVersion.ts.
      if (input.ok === true) {
        this.setMeta('data_revision', String(CURRENT_DATA_REVISION));
        this.deleteMeta('pending_rebuild');
      }
      return this.readDataset(id)!;
    });
  }

  async listDatasets(): Promise<DatasetRecord[]> {
    const ids = this.sql
      .selectObjects<{ id: number }>('SELECT id FROM datasets ORDER BY loaded_at DESC')
      .map((r) => r.id);
    return ids.map((id) => this.readDataset(id)!).filter(Boolean);
  }

  async listLoadedFileNames(): Promise<string[]> {
    return this.sql
      .selectObjects<{ name: string }>('SELECT DISTINCT name FROM dataset_files ORDER BY name')
      .map((r) => r.name);
  }

  async findFileByHash(hash: string): Promise<DatasetFileRef | null> {
    if (!hash) return null;
    const row = this.sql.selectObject<{
      name: string;
      size: number | null;
      hash: string | null;
      load_status: string | null;
      load_error: string | null;
    }>(
      `SELECT df.name, df.size, df.hash, df.load_status, df.load_error
       FROM dataset_files df
       JOIN datasets d ON d.id = df.dataset_id
       WHERE df.hash = ?
       ORDER BY d.loaded_at DESC
       LIMIT 1`,
      [hash],
    );
    return row
      ? {
          name: row.name,
          size: row.size,
          hash: row.hash,
          loadStatus: (row.load_status as DatasetFileRef['loadStatus']) ?? null,
          loadError: row.load_error,
        }
      : null;
  }

  async getEntitySummariesByIds(
    entityType: EntityKind,
    ids: readonly number[],
  ): Promise<EntitySummary[]> {
    if (ids.length === 0) return [];
    const table = ENTITY_TABLES[entityType];
    if (!table) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = this.sql.selectObjects<{
      id: number;
      name: string | null;
    }>(`SELECT id, name FROM ${table} WHERE id IN (${placeholders})`, ids as (string | number)[]);
    return rows
      .filter((r) => r.name !== null && r.name !== '')
      .map((r) => ({ id: r.id, name: r.name as string }));
  }

  async exportBytes(): Promise<Uint8Array> {
    return this.sql.exportBytes();
  }

  async importBytes(
    bytes: Uint8Array,
  ): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }> {
    const result = await this.sql.importBytes(bytes);
    // An incompatible backup gets cleared on import too; flag the rebuild so
    // the UI explains it instead of dropping the user into a blank wiki.
    if (result.didDestructiveReset) this.markPendingRebuild();
    return { backend: result.backend, schemaVersion: result.schemaVersion };
  }

  async getServerProfile(): Promise<string> {
    const row = this.sql.selectObject<{ profile_id: string }>(
      'SELECT profile_id FROM server_profile WHERE id = 1',
    );
    return row?.profile_id ?? 'vanilla-v83';
  }

  async setServerProfile(profileId: string): Promise<void> {
    // Upsert, not UPDATE: a destructive reset wipes this singleton's row, and a
    // bare UPDATE would silently no-op and lose the user's selection.
    this.sql.exec(
      'INSERT OR REPLACE INTO server_profile (id, profile_id, updated_at) VALUES (1, ?, ?)',
      [profileId, Date.now()],
    );
  }

  async clearAllData(): Promise<void> {
    this.sql.transaction(() => {
      // Order respects FK direction. No foreign keys are declared yet, but
      // keep the order stable for when we add them.
      const tables = [
        'quest_rewards',
        'quest_requirements',
        'mob_drops',
        'map_portals',
        'map_mobs',
        'map_npcs',
        'quests',
        'maps',
        'npcs',
        'mobs',
        'equips',
        'items',
        'assets',
        'extraction_extractors',
        'dataset_files',
        'datasets',
      ];
      for (const t of tables) this.sql.exec(`DELETE FROM ${t}`);
      // SQLite resets AUTOINCREMENT counters via the internal sequence table.
      this.sql.exec(`DELETE FROM sqlite_sequence WHERE name IN ('assets', 'datasets')`);
      // Drop the revision stamp and rebuild flag so a deliberately-cleared
      // library reverts to a clean first-run, not a stale revision or a
      // lingering "rebuild needed" prompt. Keep other app_meta keys.
      this.sql.exec(`DELETE FROM app_meta WHERE key IN ('data_revision', 'pending_rebuild')`);
    });
  }

  // -- internals -------------------------------------------------------------

  private upsertEquipRow(e: EquipRecord): void {
    this.sql.exec(
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

  private upsertItemRow(item: ItemRecord): void {
    this.sql.exec(
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

  private countOf(table: string): number {
    return Number(this.sql.selectValue(`SELECT COUNT(*) FROM ${table}`) ?? 0);
  }

  private readDataset(id: number): DatasetRecord | null {
    const ds = this.sql.selectObject<{
      id: number;
      label: string;
      loaded_at: number;
      wz_version: string;
      notes: string | null;
      total_ms: number | null;
      ok: number | null;
    }>('SELECT * FROM datasets WHERE id = ?', [id]);
    if (!ds) return null;
    const files = this.sql.selectObjects<{
      name: string;
      size: number | null;
      hash: string | null;
      load_status: string | null;
      load_error: string | null;
    }>(
      `SELECT name, size, hash, load_status, load_error
       FROM dataset_files WHERE dataset_id = ? ORDER BY name`,
      [id],
    );
    const extractors = this.sql.selectObjects<{
      extractor: string;
      status: string;
      rows: number;
      skipped_rows: number;
      placeholder_names: number;
      error: string | null;
    }>(
      `SELECT extractor, status, rows, skipped_rows, placeholder_names, error
       FROM extraction_extractors WHERE dataset_id = ? ORDER BY extractor`,
      [id],
    );
    return {
      id: ds.id,
      label: ds.label,
      loadedAt: ds.loaded_at,
      wzVersion: ds.wz_version,
      notes: ds.notes,
      totalMs: ds.total_ms,
      ok: ds.ok === null ? null : ds.ok === 1,
      files: files.map((f) => ({
        name: f.name,
        size: f.size,
        hash: f.hash,
        loadStatus: (f.load_status as DatasetFileRef['loadStatus']) ?? null,
        loadError: f.load_error,
      })),
      extractors: extractors.map((e) => ({
        extractor: e.extractor,
        status: e.status as ExtractorResultRecord['status'],
        rows: e.rows,
        skippedRows: e.skipped_rows,
        placeholderNames: e.placeholder_names,
        error: e.error,
      })),
    };
  }
}
