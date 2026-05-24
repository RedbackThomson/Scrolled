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
  /** WZ path the sprite came from (e.g. `Mob.wz/0100100.img/stand/0`). */
  iconPath: string | null;
  /** Decoded PNG bytes for the stand sprite. */
  iconData: Uint8Array | null;
  sourcePath: string;
}

export interface NpcRecord {
  id: number;
  name: string;
  description: string | null;
  iconPath: string | null;
  iconData: Uint8Array | null;
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
  /** WZ path of the minimap canvas (e.g. `…/100000000.img/miniMap/canvas`). */
  minimapPath: string | null;
  /** Decoded PNG bytes for the minimap, or null if the map has none. */
  minimapData: Uint8Array | null;
  sourcePath: string;
}

export interface MapNpcRecord {
  mapId: number;
  npcId: number;
  x: number | null;
  y: number | null;
}

export interface MapMobRecord {
  mapId: number;
  mobId: number;
  count: number | null;
}

export interface MapPortalRecord {
  mapId: number;
  portalName: string;
  targetMapId: number | null;
  targetPortal: string | null;
  x: number | null;
  y: number | null;
}

/** A row from `map_npcs` joined back to the NPC's name for display. */
export interface MapNpcWithName extends MapNpcRecord {
  name: string;
}

export interface MapMobWithName extends MapMobRecord {
  name: string;
  level: number | null;
}

export interface QuestRecord {
  id: number;
  name: string;
  /** Chain / area name from `String.wz/Quest.img/<id>/parent`. */
  parent: string | null;
  /** Long-form blurb from `String.wz/Quest.img/<id>/desc`, when present. */
  description: string | null;
  startNpcId: number | null;
  endNpcId: number | null;
  requiredLevel: number | null;
  /** Job bitfield from `Check.img/<id>/0/job`. Stored verbatim; UI decodes. */
  requiredJob: number | null;
  sourcePath: string;
}

/**
 * One requirement row attached to a quest. `kind` identifies what must be
 * supplied/satisfied; `targetId` and `amount` are interpreted per-kind:
 *
 *   - `item`     — collect `amount` of item `targetId`
 *   - `mob`      — kill  `amount` of mob  `targetId`
 *   - `questPre` — completed quest `targetId` (state = `amount`, usually 2)
 *   - `level`    — minimum level (amount, targetId null)
 *   - `job`      — required job bitfield (amount, targetId null)
 */
export interface QuestRequirementRecord {
  questId: number;
  kind: 'item' | 'mob' | 'questPre' | 'level' | 'job';
  targetId: number | null;
  amount: number | null;
}

/**
 * One reward row attached to a quest. `kind`:
 *
 *   - `item` — give `amount` of item `targetId`
 *   - `exp`  — `amount` exp (targetId null)
 *   - `meso` — `amount` mesos (targetId null)
 */
export interface QuestRewardRecord {
  questId: number;
  kind: 'item' | 'exp' | 'meso';
  targetId: number | null;
  amount: number | null;
}

/** A row from `quest_requirements` joined to the target item/mob/quest's
 *  display name. Targets may be null for `level` / `job` kinds. */
export interface QuestRequirementWithName extends QuestRequirementRecord {
  targetName: string | null;
}

/** A row from `quest_rewards` joined to the target item's display name. */
export interface QuestRewardWithName extends QuestRewardRecord {
  targetName: string | null;
}

/** Quest summary surfaced from a cross-link (e.g. "quests this NPC offers"). */
export interface QuestSummary {
  id: number;
  name: string;
  parent: string | null;
}

export interface DatasetFileRef {
  name: string;
  size: number | null;
  /** Lowercase SHA-256 hex digest of the file's contents. */
  hash: string | null;
  /**
   * Result of `parser.load` for this file in the run that produced this
   * record. `null` for rows recorded before extraction outcomes were
   * tracked (migration v5).
   */
  loadStatus: 'loaded' | 'load_failed' | null;
  /** Error message when `loadStatus === 'load_failed'`. */
  loadError: string | null;
}

/**
 * Outcome of one extractor on one wizard run.
 *
 *   - `status: 'ran'`  — the extractor's primary WZ file was loaded and
 *     re-processed. `rows` is the number of records produced.
 *   - `status: 'skipped'` — the extractor's primary file was either
 *     missing from this run or hash-matched without force-reprocess.
 *
 *   - `placeholderNames` is nonzero only for the `quest` extractor today;
 *     it counts records that fell back to `Quest <id>` because no name
 *     source was available.
 */
export interface ExtractorResultRecord {
  extractor: string;
  status: 'ran' | 'skipped';
  rows: number;
  skippedRows: number;
  placeholderNames: number;
  error: string | null;
}

export interface DatasetRecord {
  id: number;
  label: string;
  loadedAt: number;
  wzVersion: string;
  notes: string | null;
  /** Per-run wall-clock for the extraction phase (ms). `null` pre-v5. */
  totalMs: number | null;
  /**
   * True if the run finished cleanly. False on any caught error. `null`
   * on rows recorded before this column existed.
   */
  ok: boolean | null;
  files: DatasetFileRef[];
  /** Per-extractor outcomes recorded for this run. Empty for pre-v5 rows. */
  extractors: ExtractorResultRecord[];
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
  /** Distinct non-null `slot` values for filter UIs / sidebar nav. */
  listEquipSlots(): Promise<string[]>;
  getEquipIcon(id: number): Promise<Uint8Array | null>;

  upsertMobs(mobs: MobRecord[]): Promise<number>;
  getMob(id: number): Promise<MobRecord | null>;
  listMobs(opts?: { limit?: number; search?: string; bossOnly?: boolean }): Promise<MobRecord[]>;
  /** Decoded PNG bytes for the mob's stand sprite, or null. */
  getMobIcon(id: number): Promise<Uint8Array | null>;

  upsertNpcs(npcs: NpcRecord[]): Promise<number>;
  getNpc(id: number): Promise<NpcRecord | null>;
  listNpcs(opts?: { limit?: number; search?: string }): Promise<NpcRecord[]>;
  /** Maps where this NPC appears. */
  getNpcMaps(npcId: number): Promise<MapRecord[]>;
  /** Decoded PNG bytes for the NPC's stand sprite, or null. */
  getNpcIcon(id: number): Promise<Uint8Array | null>;

  upsertMaps(maps: MapRecord[]): Promise<number>;
  getMap(id: number): Promise<MapRecord | null>;
  listMaps(opts?: { limit?: number; search?: string }): Promise<MapRecord[]>;
  /** Decoded PNG bytes for the map minimap, or null. */
  getMapMinimap(id: number): Promise<Uint8Array | null>;
  /** NPCs + mobs + portals attached to a single map. */
  getMapNpcs(mapId: number): Promise<MapNpcWithName[]>;
  getMapMobs(mapId: number): Promise<MapMobWithName[]>;
  getMapPortals(mapId: number): Promise<MapPortalRecord[]>;

  upsertQuests(quests: QuestRecord[]): Promise<number>;
  getQuest(id: number): Promise<QuestRecord | null>;
  listQuests(opts?: {
    limit?: number;
    search?: string;
    parent?: string;
  }): Promise<QuestRecord[]>;
  /** Distinct quest `parent` values for filter UIs. */
  listQuestParents(): Promise<string[]>;
  /** Requirements / rewards joined to the target's display name. */
  getQuestRequirements(questId: number): Promise<QuestRequirementWithName[]>;
  getQuestRewards(questId: number): Promise<QuestRewardWithName[]>;
  /** Quests an NPC offers (start or end). */
  getNpcQuests(npcId: number): Promise<QuestSummary[]>;
  /** Quests that ask for the given item as a requirement. */
  getItemQuests(itemId: number): Promise<QuestSummary[]>;
  /** Quests that require killing the given mob. */
  getMobQuests(mobId: number): Promise<QuestSummary[]>;
  /** Replace requirements + rewards for the given quest IDs in one
   *  transaction; mirrors `replaceMapLife`. */
  replaceQuestRelations(rows: {
    requirements: QuestRequirementRecord[];
    rewards: QuestRewardRecord[];
  }): Promise<void>;

  /** Replace all rows of a join table for the given map IDs. Used by the
   *  map extractor to keep join data consistent with re-extractions. */
  replaceMapLife(rows: {
    npcs: MapNpcRecord[];
    mobs: MapMobRecord[];
    portals: MapPortalRecord[];
  }): Promise<void>;

  /** Names + IDs of all entities for the in-app search index. */
  listSearchEntries(): Promise<SearchEntry[]>;

  recordDataset(input: {
    label: string;
    wzVersion: string;
    files: DatasetFileRef[];
    notes?: string;
    /** Wall-clock duration of the extraction phase in ms. */
    totalMs?: number;
    /** True if no extractor errored. */
    ok?: boolean;
    /** Per-extractor outcomes from the run. */
    extractors?: ExtractorResultRecord[];
  }): Promise<DatasetRecord>;
  listDatasets(): Promise<DatasetRecord[]>;
  /** Distinct file names ever loaded, across every dataset. */
  listLoadedFileNames(): Promise<string[]>;
  /** Find the most recent dataset_files row whose hash matches, or null. */
  findFileByHash(hash: string): Promise<DatasetFileRef | null>;

  clearAllData(): Promise<void>;

  /**
   * Serialize the live database to a Uint8Array. Returned bytes are a
   * valid SQLite file the user can save and re-import later.
   */
  exportBytes(): Promise<Uint8Array>;

  /**
   * Replace the database with the given bytes. The bytes must look like a
   * SQLite file (header magic check) or this rejects without touching the
   * live DB. After import, migrations run so an older schema gets brought
   * up to current. Resolves to the new schema version + backend.
   */
  importBytes(bytes: Uint8Array): Promise<{ backend: 'opfs' | 'memory'; schemaVersion: number }>;
}

export type EntityKind = 'item' | 'equip' | 'mob' | 'npc' | 'map' | 'quest';

export interface SearchEntry {
  id: number;
  name: string;
  entity: EntityKind;
  category: string | null;
}
