// Public types for the DB layer.
//
// These cross the worker boundary, so they must be structured-cloneable.
// Domain types here mirror the SQL schema 1:1 — extractors (Phase 3+) will
// populate them.

export interface ItemRecord {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  iconPath: string | null;
  /** Decoded PNG bytes, populated by extraction; null if not yet decoded. */
  iconData: Uint8Array | null;
  price: number | null;
  stackSize: number | null;
  requiredLevel: number | null;
  sourcePath: string;
}

export interface EquipRecord {
  id: number;
  name: string;
  description: string | null;
  slot: string | null;
  category: string | null;
  requiredLevel: number | null;
  requiredStr: number | null;
  requiredDex: number | null;
  requiredInt: number | null;
  requiredLuk: number | null;
  requiredJob: number | null;
  attack: number | null;
  magicAttack: number | null;
  defense: number | null;
  magicDefense: number | null;
  accuracy: number | null;
  avoidability: number | null;
  upgradeSlots: number | null;
  iconPath: string | null;
  iconData: Uint8Array | null;
  sourcePath: string;
}

export interface MobRecord {
  id: number;
  name: string;
  level: number | null;
  hp: number | null;
  mp: number | null;
  exp: number | null;
  isBoss: boolean;
  elementAttack: string | null;
  elementDefensesJson: string | null;
  sourcePath: string;
}

export interface NpcRecord {
  id: number;
  name: string;
  description: string | null;
  sourcePath: string;
}

export interface MapRecord {
  id: number;
  name: string | null;
  streetName: string | null;
  returnMapId: number | null;
  forcedReturnMapId: number | null;
  fieldLimit: number | null;
  mobRate: number | null;
  sourcePath: string;
}

export interface QuestRecord {
  id: number;
  name: string;
  startNpcId: number | null;
  endNpcId: number | null;
  requiredLevel: number | null;
  requiredJob: number | null;
  sourcePath: string;
}

export interface DatasetRecord {
  id: number;
  label: string;
  loadedAt: number;
  wzVersion: string;
  notes: string | null;
  files: { name: string; size: number | null }[];
}

export interface DbStatus {
  schemaVersion: number;
  backend: 'opfs' | 'memory';
  counts: {
    items: number;
    equips: number;
    mobs: number;
    npcs: number;
    maps: number;
    quests: number;
    datasets: number;
  };
}

/**
 * Boundary contract for the DB layer. Implementations may be the in-worker
 * SQLite-WASM instance (browser) or a hand-driver wrapping better-sqlite3 in
 * Node tests later.
 */
export interface GameDatabase {
  open(): Promise<DbStatus>;
  status(): Promise<DbStatus>;

  upsertItem(item: ItemRecord): Promise<void>;
  upsertItems(items: ItemRecord[]): Promise<number>;
  getItem(id: number): Promise<ItemRecord | null>;
  listItems(opts?: { limit?: number; search?: string; category?: string }): Promise<ItemRecord[]>;
  /** Just the persisted icon bytes for an item, or null. */
  getItemIcon(id: number): Promise<Uint8Array | null>;

  upsertEquip(equip: EquipRecord): Promise<void>;
  upsertEquips(equips: EquipRecord[]): Promise<number>;
  getEquip(id: number): Promise<EquipRecord | null>;
  listEquips(opts?: { limit?: number; search?: string; slot?: string }): Promise<EquipRecord[]>;
  getEquipIcon(id: number): Promise<Uint8Array | null>;

  /** Names + IDs of all entities for the in-app search index. */
  listSearchEntries(): Promise<SearchEntry[]>;

  recordDataset(input: {
    label: string;
    wzVersion: string;
    files: { name: string; size: number | null }[];
    notes?: string;
  }): Promise<DatasetRecord>;
  listDatasets(): Promise<DatasetRecord[]>;

  clearAllData(): Promise<void>;
}

export interface SearchEntry {
  id: number;
  name: string;
  /** 'item' | 'equip' (extend as more entity types come online) */
  entity: 'item' | 'equip';
  category: string | null;
}
