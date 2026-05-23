// Domain query helpers built on top of the thin `Sqlite` wrapper.
//
// Phase 2 surface: items CRUD, datasets, status, clear-all. Extractors in
// Phase 3+ will add equip/mob/npc/map/quest helpers alongside these.

import type { Sqlite, Row } from './sqlite';
import type {
  DatasetFileRef,
  DatasetRecord,
  DbStatus,
  EquipRecord,
  ItemRecord,
  MapMobRecord,
  MapMobWithName,
  MapNpcRecord,
  MapNpcWithName,
  MapPortalRecord,
  MapRecord,
  MobRecord,
  NpcRecord,
  GameDatabase,
  SearchEntry,
} from './types';

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
  source_path: string;
}

interface NpcRow extends Row {
  id: number;
  name: string;
  description: string | null;
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
    sourcePath: r.source_path,
  };
}

function rowToNpc(r: NpcRow): NpcRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
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
    opts: { limit?: number; search?: string; category?: string } = {},
  ): Promise<ItemRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search && opts.search.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    if (opts.category) {
      where.push('category = ?');
      params.push(opts.category);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    // List queries deliberately skip `icon_data` — the BLOB lookup happens
    // per-icon via `getItemIcon(id)` so we don't drag MBs of bytes into a
    // list-render result.
    return this.sql
      .selectObjects<ItemRow>(
        `SELECT id, name, description, category, subcategory, icon_path, NULL AS icon_data,
                price, stack_size, required_level, source_path
         FROM items ${clause} ORDER BY name LIMIT ?`,
        params,
      )
      .map(rowToItem);
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
    opts: { limit?: number; search?: string; slot?: string } = {},
  ): Promise<EquipRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search && opts.search.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    if (opts.slot) {
      where.push('slot = ?');
      params.push(opts.slot);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    return this.sql
      .selectObjects<EquipRow>(
        `SELECT id, name, description, slot, category, required_level,
                required_str, required_dex, required_int, required_luk, required_job,
                attack, magic_attack, defense, magic_defense, accuracy, avoidability,
                upgrade_slots, icon_path, NULL AS icon_data, source_path
         FROM equips ${clause} ORDER BY name LIMIT ?`,
        params,
      )
      .map(rowToEquip);
  }

  async upsertMobs(mobs: MobRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const m of mobs) {
        this.sql.exec(
          `INSERT INTO mobs (
            id, name, level, hp, mp, exp, is_boss,
            element_attack, element_defenses_json, source_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name                  = excluded.name,
            level                 = excluded.level,
            hp                    = excluded.hp,
            mp                    = excluded.mp,
            exp                   = excluded.exp,
            is_boss               = excluded.is_boss,
            element_attack        = excluded.element_attack,
            element_defenses_json = excluded.element_defenses_json,
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
            m.sourcePath,
          ],
        );
      }
    });
    return mobs.length;
  }

  async getMob(id: number): Promise<MobRecord | null> {
    const row = this.sql.selectObject<MobRow>('SELECT * FROM mobs WHERE id = ?', [id]);
    return row ? rowToMob(row) : null;
  }

  async listMobs(
    opts: { limit?: number; search?: string; bossOnly?: boolean } = {},
  ): Promise<MobRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    if (opts.bossOnly) {
      where.push('is_boss = 1');
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    return this.sql
      .selectObjects<MobRow>(
        `SELECT * FROM mobs ${clause} ORDER BY level NULLS LAST, name LIMIT ?`,
        params,
      )
      .map(rowToMob);
  }

  async upsertNpcs(npcs: NpcRecord[]): Promise<number> {
    this.sql.transaction(() => {
      for (const n of npcs) {
        this.sql.exec(
          `INSERT INTO npcs (id, name, description, source_path)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name        = excluded.name,
             description = excluded.description,
             source_path = excluded.source_path`,
          [n.id, n.name, n.description, n.sourcePath],
        );
      }
    });
    return npcs.length;
  }

  async getNpc(id: number): Promise<NpcRecord | null> {
    const row = this.sql.selectObject<NpcRow>('SELECT * FROM npcs WHERE id = ?', [id]);
    return row ? rowToNpc(row) : null;
  }

  async listNpcs(opts: { limit?: number; search?: string } = {}): Promise<NpcRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('name LIKE ?');
      params.push(`%${opts.search.trim()}%`);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    return this.sql
      .selectObjects<NpcRow>(`SELECT * FROM npcs ${clause} ORDER BY name LIMIT ?`, params)
      .map(rowToNpc);
  }

  async getNpcMaps(npcId: number): Promise<MapRecord[]> {
    return this.sql
      .selectObjects<MapRow>(
        `SELECT DISTINCT m.* FROM maps m
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
            field_limit, mob_rate, source_path
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name                 = excluded.name,
            street_name          = excluded.street_name,
            return_map_id        = excluded.return_map_id,
            forced_return_map_id = excluded.forced_return_map_id,
            field_limit          = excluded.field_limit,
            mob_rate             = excluded.mob_rate,
            source_path          = excluded.source_path`,
          [
            m.id,
            m.name,
            m.streetName,
            m.returnMapId,
            m.forcedReturnMapId,
            m.fieldLimit,
            m.mobRate,
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

  async listMaps(opts: { limit?: number; search?: string } = {}): Promise<MapRecord[]> {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 5000);
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (opts.search?.trim()) {
      where.push('(name LIKE ? OR street_name LIKE ?)');
      const q = `%${opts.search.trim()}%`;
      params.push(q, q);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);
    return this.sql
      .selectObjects<MapRow>(
        `SELECT * FROM maps ${clause} ORDER BY street_name, name LIMIT ?`,
        params,
      )
      .map(rowToMap);
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
    return out;
  }

  async recordDataset(input: {
    label: string;
    wzVersion: string;
    files: DatasetFileRef[];
    notes?: string;
  }): Promise<DatasetRecord> {
    return this.sql.transaction(() => {
      this.sql.exec(
        'INSERT INTO datasets (label, loaded_at, wz_version, notes) VALUES (?, ?, ?, ?)',
        [input.label, Date.now(), input.wzVersion, input.notes ?? null],
      );
      const id = Number(this.sql.selectValue('SELECT last_insert_rowid()'));
      for (const f of input.files) {
        this.sql.exec(
          'INSERT INTO dataset_files (dataset_id, name, size, hash) VALUES (?, ?, ?, ?)',
          [id, f.name, f.size ?? null, f.hash ?? null],
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
    }>(
      `SELECT df.name, df.size, df.hash
       FROM dataset_files df
       JOIN datasets d ON d.id = df.dataset_id
       WHERE df.hash = ?
       ORDER BY d.loaded_at DESC
       LIMIT 1`,
      [hash],
    );
    return row ? { name: row.name, size: row.size, hash: row.hash } : null;
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
    }>('SELECT * FROM datasets WHERE id = ?', [id]);
    if (!ds) return null;
    const files = this.sql.selectObjects<{
      name: string;
      size: number | null;
      hash: string | null;
    }>('SELECT name, size, hash FROM dataset_files WHERE dataset_id = ? ORDER BY name', [id]);
    return {
      id: ds.id,
      label: ds.label,
      loadedAt: ds.loaded_at,
      wzVersion: ds.wz_version,
      notes: ds.notes,
      files: files.map((f) => ({ name: f.name, size: f.size, hash: f.hash })),
    };
  }
}
