// Domain query helpers built on top of the thin `Sqlite` wrapper.
//
// Phase 2 surface: items CRUD, datasets, status, clear-all. Extractors in
// Phase 3+ will add equip/mob/npc/map/quest helpers alongside these.

import type { Sqlite, Row } from './sqlite';
import type {
  ColumnFilter,
  DatasetFileRef,
  DatasetRecord,
  DbStatus,
  ExtractorResultRecord,
  EquipRecord,
  ItemRecord,
  ListOptsBase,
  MapMobRecord,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapRecord,
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
  SortDir,
} from './types';

/**
 * Per-entity allowlist mapping public column ids → SQL column names plus
 * each column's default sort direction. The mapping is the security
 * boundary: `orderBy` strings come straight from URL query params, but
 * we never interpolate them into SQL — we look them up here and emit a
 * literal column name. Unknown keys fall back to the entity's default.
 */
interface OrderSpec {
  col: string;
  defaultDir: SortDir;
}

const ITEM_ORDER: Record<string, OrderSpec> = {
  name:          { col: 'name',           defaultDir: 'asc'  },
  category:      { col: 'category',       defaultDir: 'asc'  },
  subcategory:   { col: 'subcategory',    defaultDir: 'asc'  },
  requiredLevel: { col: 'required_level', defaultDir: 'asc'  },
  price:         { col: 'price',          defaultDir: 'desc' },
  id:            { col: 'id',             defaultDir: 'asc'  },
};
const ITEM_ORDER_DEFAULT = 'name';

const EQUIP_ORDER: Record<string, OrderSpec> = {
  name:          { col: 'name',           defaultDir: 'asc'  },
  slot:          { col: 'slot',           defaultDir: 'asc'  },
  requiredLevel: { col: 'required_level', defaultDir: 'asc'  },
  attack:        { col: 'attack',         defaultDir: 'desc' },
  magicAttack:   { col: 'magic_attack',   defaultDir: 'desc' },
  defense:       { col: 'defense',        defaultDir: 'desc' },
  magicDefense:  { col: 'magic_defense',  defaultDir: 'desc' },
  accuracy:      { col: 'accuracy',       defaultDir: 'desc' },
  avoidability:  { col: 'avoidability',   defaultDir: 'desc' },
  upgradeSlots:  { col: 'upgrade_slots',  defaultDir: 'desc' },
  id:            { col: 'id',             defaultDir: 'asc'  },
};
const EQUIP_ORDER_DEFAULT = 'name';

const MOB_ORDER: Record<string, OrderSpec> = {
  name:    { col: 'name',           defaultDir: 'asc'  },
  level:   { col: 'level',          defaultDir: 'asc'  },
  hp:      { col: 'hp',             defaultDir: 'asc'  },
  mp:      { col: 'mp',             defaultDir: 'asc'  },
  exp:     { col: 'exp',            defaultDir: 'desc' },
  element: { col: 'element_attack', defaultDir: 'asc'  },
  id:      { col: 'id',             defaultDir: 'asc'  },
};
const MOB_ORDER_DEFAULT = 'level';

const NPC_ORDER: Record<string, OrderSpec> = {
  name: { col: 'name', defaultDir: 'asc' },
  id:   { col: 'id',   defaultDir: 'asc' },
};
const NPC_ORDER_DEFAULT = 'name';

const MAP_ORDER: Record<string, OrderSpec> = {
  name:        { col: 'name',          defaultDir: 'asc' },
  streetName:  { col: 'street_name',   defaultDir: 'asc' },
  mobRate:     { col: 'mob_rate',      defaultDir: 'asc' },
  returnMapId: { col: 'return_map_id', defaultDir: 'asc' },
  id:          { col: 'id',            defaultDir: 'asc' },
};
const MAP_ORDER_DEFAULT = 'name';

const QUEST_ORDER: Record<string, OrderSpec> = {
  name:          { col: 'name',           defaultDir: 'asc' },
  parent:        { col: 'parent',         defaultDir: 'asc' },
  requiredLevel: { col: 'required_level', defaultDir: 'asc' },
  id:            { col: 'id',             defaultDir: 'asc' },
};
const QUEST_ORDER_DEFAULT = 'name';

function resolveOrder(
  allow: Record<string, OrderSpec>,
  fallbackKey: string,
  orderBy: string | undefined,
  dir: SortDir | undefined,
): { col: string; dir: SortDir } {
  const spec = (orderBy && allow[orderBy]) || allow[fallbackKey];
  return { col: spec.col, dir: dir === 'desc' || dir === 'asc' ? dir : spec.defaultDir };
}

function clampLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? 50, 1), 500);
}

function clampOffset(offset: number | undefined): number {
  return Math.max(offset ?? 0, 0);
}

/**
 * Per-entity column-filter allowlist. Mirrors the ORDER BY allowlists:
 * public column ids (the same ones the UI sends from URL state) map to
 * the SQL column they back, plus the filter type. Unknown filter keys
 * are silently dropped — same defence-in-depth as ORDER BY.
 */
interface FilterSpec {
  col: string;
  type: 'string' | 'number';
}

const ITEM_FILTER: Record<string, FilterSpec> = {
  name:          { col: 'name',           type: 'string' },
  category:      { col: 'category',       type: 'string' },
  subcategory:   { col: 'subcategory',    type: 'string' },
  requiredLevel: { col: 'required_level', type: 'number' },
  price:         { col: 'price',          type: 'number' },
  id:            { col: 'id',             type: 'number' },
};

const EQUIP_FILTER: Record<string, FilterSpec> = {
  name:          { col: 'name',           type: 'string' },
  slot:          { col: 'slot',           type: 'string' },
  requiredLevel: { col: 'required_level', type: 'number' },
  attack:        { col: 'attack',         type: 'number' },
  magicAttack:   { col: 'magic_attack',   type: 'number' },
  defense:       { col: 'defense',        type: 'number' },
  magicDefense:  { col: 'magic_defense',  type: 'number' },
  accuracy:      { col: 'accuracy',       type: 'number' },
  avoidability:  { col: 'avoidability',   type: 'number' },
  upgradeSlots:  { col: 'upgrade_slots',  type: 'number' },
  id:            { col: 'id',             type: 'number' },
};

const MOB_FILTER: Record<string, FilterSpec> = {
  name:    { col: 'name',           type: 'string' },
  level:   { col: 'level',          type: 'number' },
  hp:      { col: 'hp',             type: 'number' },
  mp:      { col: 'mp',             type: 'number' },
  exp:     { col: 'exp',            type: 'number' },
  element: { col: 'element_attack', type: 'string' },
  id:      { col: 'id',             type: 'number' },
};

const NPC_FILTER: Record<string, FilterSpec> = {
  name: { col: 'name', type: 'string' },
  id:   { col: 'id',   type: 'number' },
};

const MAP_FILTER: Record<string, FilterSpec> = {
  name:        { col: 'name',          type: 'string' },
  streetName:  { col: 'street_name',   type: 'string' },
  mobRate:     { col: 'mob_rate',      type: 'number' },
  returnMapId: { col: 'return_map_id', type: 'number' },
  id:          { col: 'id',            type: 'number' },
};

const QUEST_FILTER: Record<string, FilterSpec> = {
  name:          { col: 'name',           type: 'string' },
  parent:        { col: 'parent',         type: 'string' },
  requiredLevel: { col: 'required_level', type: 'number' },
  id:            { col: 'id',             type: 'number' },
};

/**
 * Append WHERE fragments + bind params for each known filter. Unknown
 * filter keys, blank-string values, and ranges with neither bound set
 * are skipped. String matches use LIKE … ESCAPE '\' with the LIKE
 * metacharacters (`%`, `_`, `\`) escaped in the user-supplied value, so
 * a user typing "50%" matches the literal three characters regardless
 * of `mode`. SQLite's LIKE is case-insensitive over ASCII by default.
 */
function applyFilters(
  allow: Record<string, FilterSpec>,
  filters: Record<string, ColumnFilter> | undefined,
  where: string[],
  params: (string | number)[],
): void {
  if (!filters) return;
  for (const [key, filter] of Object.entries(filters)) {
    const spec = allow[key];
    if (!spec) continue;
    if (spec.type === 'string' && filter.kind === 'string' && filter.value) {
      const esc = escapeLikeLiteral(filter.value);
      const pattern =
        filter.mode === 'prefix'
          ? `${esc}%`
          : filter.mode === 'suffix'
            ? `%${esc}`
            : filter.mode === 'equals'
              ? esc
              : `%${esc}%`;
      where.push(`${spec.col} LIKE ? ESCAPE '\\'`);
      params.push(pattern);
    } else if (spec.type === 'number' && filter.kind === 'range') {
      if (filter.min !== undefined && Number.isFinite(filter.min)) {
        where.push(`${spec.col} >= ?`);
        params.push(filter.min);
      }
      if (filter.max !== undefined && Number.isFinite(filter.max)) {
        where.push(`${spec.col} <= ?`);
        params.push(filter.max);
      }
    }
  }
}

function escapeLikeLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

interface ItemRow extends Row {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  price: number | null;
  stack_size: number | null;
  required_level: number | null;
  source_path: string;
}

interface EquipRow extends Row {
  id: number;
  name: string;
  description: string | null;
  slot: string | null;
  category: string | null;
  required_level: number | null;
  required_str: number | null;
  required_dex: number | null;
  required_int: number | null;
  required_luk: number | null;
  required_job: number | null;
  attack: number | null;
  magic_attack: number | null;
  defense: number | null;
  magic_defense: number | null;
  accuracy: number | null;
  avoidability: number | null;
  upgrade_slots: number | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  source_path: string;
}

function rowToItem(r: ItemRow): ItemRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    subcategory: r.subcategory,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    price: r.price,
    stackSize: r.stack_size,
    requiredLevel: r.required_level,
    sourcePath: r.source_path,
  };
}

interface MobRow extends Row {
  id: number;
  name: string;
  level: number | null;
  hp: number | null;
  mp: number | null;
  exp: number | null;
  is_boss: number;
  element_attack: string | null;
  element_defenses_json: string | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  source_path: string;
}

interface NpcRow extends Row {
  id: number;
  name: string;
  description: string | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  source_path: string;
}

interface MapRow extends Row {
  id: number;
  name: string | null;
  street_name: string | null;
  return_map_id: number | null;
  forced_return_map_id: number | null;
  field_limit: number | null;
  mob_rate: number | null;
  minimap_path: string | null;
  minimap_data: Uint8Array | null;
  source_path: string;
}

function rowToMob(r: MobRow): MobRecord {
  return {
    id: r.id,
    name: r.name,
    level: r.level,
    hp: r.hp,
    mp: r.mp,
    exp: r.exp,
    isBoss: r.is_boss === 1,
    elementAttack: r.element_attack,
    elementDefensesJson: r.element_defenses_json,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    sourcePath: r.source_path,
  };
}

function rowToNpc(r: NpcRow): NpcRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    sourcePath: r.source_path,
  };
}

function rowToMap(r: MapRow): MapRecord {
  return {
    id: r.id,
    name: r.name,
    streetName: r.street_name,
    returnMapId: r.return_map_id,
    forcedReturnMapId: r.forced_return_map_id,
    fieldLimit: r.field_limit,
    mobRate: r.mob_rate,
    minimapPath: r.minimap_path,
    minimapData: r.minimap_data,
    sourcePath: r.source_path,
  };
}

interface QuestRow extends Row {
  id: number;
  name: string;
  parent: string | null;
  description: string | null;
  start_npc_id: number | null;
  end_npc_id: number | null;
  required_level: number | null;
  required_job: number | null;
  source_path: string;
}

function rowToQuest(r: QuestRow): QuestRecord {
  return {
    id: r.id,
    name: r.name,
    parent: r.parent,
    description: r.description,
    startNpcId: r.start_npc_id,
    endNpcId: r.end_npc_id,
    requiredLevel: r.required_level,
    requiredJob: r.required_job,
    sourcePath: r.source_path,
  };
}

function rowToEquip(r: EquipRow): EquipRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    slot: r.slot,
    category: r.category,
    requiredLevel: r.required_level,
    requiredStr: r.required_str,
    requiredDex: r.required_dex,
    requiredInt: r.required_int,
    requiredLuk: r.required_luk,
    requiredJob: r.required_job,
    attack: r.attack,
    magicAttack: r.magic_attack,
    defense: r.defense,
    magicDefense: r.magic_defense,
    accuracy: r.accuracy,
    avoidability: r.avoidability,
    upgradeSlots: r.upgrade_slots,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    sourcePath: r.source_path,
  };
}

export class DbApi implements GameDatabase {
  constructor(private readonly sql: Sqlite) {}

  async open(): Promise<DbStatus> {
    await this.sql.open();
    return this.status();
  }

  async status(): Promise<DbStatus> {
    const schemaVersion = Number(this.sql.selectValue('SELECT MAX(version) FROM _migrations') ?? 0);
    return {
      schemaVersion,
      backend: this.sql.backend,
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
                  price, stack_size, required_level, source_path
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
    opts: ListOptsBase & { slot?: string } = {},
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
                  upgrade_slots, icon_path, NULL AS icon_data, source_path
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

  async listMobs(
    opts: ListOptsBase & { bossOnly?: boolean } = {},
  ): Promise<PageResult<MobRecord>> {
    const limit = clampLimit(opts.limit);
    const offset = clampOffset(opts.offset);
    const order = resolveOrder(MOB_ORDER, MOB_ORDER_DEFAULT, opts.orderBy, opts.dir);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    if (opts.bossOnly) {
      where.push('is_boss = 1');
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
                m.field_limit, m.mob_rate, m.minimap_path, NULL AS minimap_data, m.source_path
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
            field_limit, mob_rate, minimap_path, minimap_data, source_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name                 = excluded.name,
            street_name          = excluded.street_name,
            return_map_id        = excluded.return_map_id,
            forced_return_map_id = excluded.forced_return_map_id,
            field_limit          = excluded.field_limit,
            mob_rate             = excluded.mob_rate,
            minimap_path         = excluded.minimap_path,
            minimap_data         = COALESCE(excluded.minimap_data, maps.minimap_data),
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
                  field_limit, mob_rate, minimap_path, NULL AS minimap_data, source_path
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

  async getMapPortals(mapId: number): Promise<MapPortalRecord[]> {
    return this.sql
      .selectObjects<{
        map_id: number;
        portal_name: string;
        target_map_id: number | null;
        target_portal: string | null;
        x: number | null;
        y: number | null;
      }>(
        `SELECT map_id, portal_name, target_map_id, target_portal, x, y
         FROM map_portals WHERE map_id = ? ORDER BY portal_name`,
        [mapId],
      )
      .map((r) => ({
        mapId: r.map_id,
        portalName: r.portal_name,
        targetMapId: r.target_map_id,
        targetPortal: r.target_portal,
        x: r.x,
        y: r.y,
      }));
  }

  async replaceMapLife(rows: {
    npcs: MapNpcRecord[];
    mobs: MapMobRecord[];
    portals: MapPortalRecord[];
  }): Promise<void> {
    // Collect distinct map IDs across all three so we wipe their previous
    // rows before reinserting. Avoids stale entries when a map is
    // re-extracted with different NPC/mob/portal sets.
    const mapIds = new Set<number>();
    for (const r of rows.npcs) mapIds.add(r.mapId);
    for (const r of rows.mobs) mapIds.add(r.mapId);
    for (const r of rows.portals) mapIds.add(r.mapId);
    this.sql.transaction(() => {
      for (const id of mapIds) {
        this.sql.exec('DELETE FROM map_npcs    WHERE map_id = ?', [id]);
        this.sql.exec('DELETE FROM map_mobs    WHERE map_id = ?', [id]);
        this.sql.exec('DELETE FROM map_portals WHERE map_id = ?', [id]);
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
          `INSERT OR REPLACE INTO map_portals (map_id, portal_name, target_map_id, target_portal, x, y)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [r.mapId, r.portalName, r.targetMapId, r.targetPortal, r.x, r.y],
        );
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
      .selectObjects<{ parent: string }>(
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
      for (const f of input.files) {
        this.sql.exec(
          `INSERT INTO dataset_files (dataset_id, name, size, hash, load_status, load_error)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            f.name,
            f.size ?? null,
            f.hash ?? null,
            f.loadStatus ?? null,
            f.loadError ?? null,
          ],
        );
      }
      for (const e of input.extractors ?? []) {
        this.sql.exec(
          `INSERT INTO extraction_extractors
             (dataset_id, extractor, status, rows, skipped_rows, placeholder_names, error)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            e.extractor,
            e.status,
            e.rows,
            e.skippedRows,
            e.placeholderNames,
            e.error ?? null,
          ],
        );
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

  async exportBytes(): Promise<Uint8Array> {
    return this.sql.exportBytes();
  }

  async importBytes(bytes: Uint8Array): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }> {
    return this.sql.importBytes(bytes);
  }

  async clearAllData(): Promise<void> {
    this.sql.transaction(() => {
      // Order respects FK direction. No foreign keys are declared yet, but
      // keep the order stable for when we add them.
      const tables = [
        'quest_rewards',
        'quest_requirements',
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
        'dataset_files',
        'datasets',
      ];
      for (const t of tables) this.sql.exec(`DELETE FROM ${t}`);
      // SQLite resets AUTOINCREMENT counters via the internal sequence table.
      this.sql.exec(`DELETE FROM sqlite_sequence WHERE name IN ('assets', 'datasets')`);
    });
  }

  // -- internals -------------------------------------------------------------

  private upsertEquipRow(e: EquipRecord): void {
    this.sql.exec(
      `INSERT INTO equips (
        id, name, description, slot, category, required_level,
        required_str, required_dex, required_int, required_luk, required_job,
        attack, magic_attack, defense, magic_defense, accuracy, avoidability,
        upgrade_slots, icon_path, icon_data, source_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        price, stack_size, required_level, source_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
