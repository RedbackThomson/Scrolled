// Domain query helpers built on top of the thin `Sqlite` wrapper.
//
// Phase 2 surface: items CRUD, datasets, status, clear-all. Extractors in
// Phase 3+ will add equip/mob/npc/map/quest helpers alongside these.

import type { Sqlite, Row } from './sqlite';
import type {
  DatasetRecord,
  DbStatus,
  EquipRecord,
  ItemRecord,
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

  async listSearchEntries(): Promise<SearchEntry[]> {
    const items = this.sql.selectObjects<{ id: number; name: string; category: string | null }>(
      `SELECT id, name, category FROM items`,
    );
    const equips = this.sql.selectObjects<{ id: number; name: string; slot: string | null }>(
      `SELECT id, name, slot FROM equips`,
    );
    const out: SearchEntry[] = [];
    for (const r of items)
      out.push({ id: r.id, name: r.name, entity: 'item', category: r.category });
    for (const r of equips) out.push({ id: r.id, name: r.name, entity: 'equip', category: r.slot });
    return out;
  }

  async recordDataset(input: {
    label: string;
    wzVersion: string;
    files: { name: string; size: number | null }[];
    notes?: string;
  }): Promise<DatasetRecord> {
    return this.sql.transaction(() => {
      this.sql.exec(
        'INSERT INTO datasets (label, loaded_at, wz_version, notes) VALUES (?, ?, ?, ?)',
        [input.label, Date.now(), input.wzVersion, input.notes ?? null],
      );
      const id = Number(this.sql.selectValue('SELECT last_insert_rowid()'));
      for (const f of input.files) {
        this.sql.exec('INSERT INTO dataset_files (dataset_id, name, size) VALUES (?, ?, ?)', [
          id,
          f.name,
          f.size ?? null,
        ]);
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
    const files = this.sql.selectObjects<{ name: string; size: number | null }>(
      'SELECT name, size FROM dataset_files WHERE dataset_id = ? ORDER BY name',
      [id],
    );
    return {
      id: ds.id,
      label: ds.label,
      loadedAt: ds.loaded_at,
      wzVersion: ds.wz_version,
      notes: ds.notes,
      files,
    };
  }
}
