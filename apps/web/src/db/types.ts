// Public types for the DB layer.
//
// These cross the worker boundary, so they must be structured-cloneable.
// Domain types here mirror the SQL schema 1:1.

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
  /**
   * Metadata flags from the WZ `info` block, each true when the key is
   * present and non-zero. Surfaced as badges on the detail page.
   */
  cash: boolean;
  tradeBlock: boolean;
  accountSharable: boolean;
  only: boolean;
  quest: boolean;
  timeLimited: boolean;
  expireOnLogout: boolean;
  pickupBlock: boolean;
  notSale: boolean;
  dropBlock: boolean;
  tradeAvailable: boolean;
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
  incStr: number | null;
  incDex: number | null;
  incInt: number | null;
  incLuk: number | null;
  incHp: number | null;
  incMp: number | null;
  incSpeed: number | null;
  incJump: number | null;
  /**
   * `info/cash` from the WZ tree. True means the equip is a cash-shop
   * cosmetic that provides no stats; false is a regular in-game equip.
   */
  cash: boolean;
  /**
   * Resolved equip type from `Math.floor(id / 10000)` looked up against a
   * fixed table. Stored as a string slug (e.g. `wand`, `one-handed-sword`)
   * so the UI can treat it as an enum without re-running the lookup. Null
   * when the bucket isn't in the table — today that means "not a weapon",
   * so non-null is the canonical "is this a weapon?" check.
   */
  equipType: string | null;
  /**
   * Extra metadata flags from the WZ `info` block. Each is true when the
   * corresponding key is present and non-zero. Mirrors the in-game item
   * properties shown as badges on the detail page.
   */
  tradeBlock: boolean;
  equipTradeBlock: boolean;
  accountSharable: boolean;
  only: boolean;
  quest: boolean;
  timeLimited: boolean;
  expireOnLogout: boolean;
  pickupBlock: boolean;
  notSale: boolean;
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
  /**
   * Minimap geometry — needed to project game coords onto the minimap:
   *   pixelX = (gameX + minimapCenterX) / minimapMag
   *   pixelY = (gameY + minimapCenterY) / minimapMag
   * All five are null when the map has no minimap.
   */
  minimapCenterX: number | null;
  minimapCenterY: number | null;
  minimapWidth: number | null;
  minimapHeight: number | null;
  minimapMag: number | null;
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
  /**
   * WZ child index of the portal in `<map>/portal/<idx>`. Unique within a
   * map; identifies a portal even when its `portalName` (e.g. `sp`) is
   * shared by several entries.
   */
  idx: number;
  portalName: string;
  targetMapId: number | null;
  targetPortal: string | null;
  x: number | null;
  y: number | null;
  /**
   * Portal type from the WZ `pt` property. 0 = player spawn, 2 = regular
   * portal, 6 = script-driven warp, etc. Used by the map viewer to bucket
   * portals into spawn / portal / internal-teleport layers.
   */
  portalType: number | null;
  /** Optional `script` name attached to scripted portals. */
  script: string | null;
}

/** A row from `map_portals` joined back to the target map's display name. */
export interface MapPortalWithName extends MapPortalRecord {
  targetMapName: string | null;
}

/** One mob spawn position on a map. Multiple rows with the same (mapId, mobId)
 *  are expected when a mob has several spawn points. */
export interface MapMobSpawnRecord {
  mapId: number;
  mobId: number;
  x: number | null;
  y: number | null;
}

/** A row from `map_mob_spawns` joined back to the mob's name/level for display. */
export interface MapMobSpawnWithName extends MapMobSpawnRecord {
  name: string;
  level: number | null;
}

/** A row from `map_npcs` joined back to the NPC's name for display. */
export interface MapNpcWithName extends MapNpcRecord {
  name: string;
}

export interface MapMobWithName extends MapMobRecord {
  name: string;
  level: number | null;
}

/** A map this mob appears on, with the aggregated spawn count from `map_mobs`. */
export interface MobMapAppearance extends MapRecord {
  spawnCount: number | null;
}

/**
 * One item this mob can drop, taken from
 * `String.wz/MonsterBook.img/<mobId>/reward/<index>`. Rates and quantities
 * aren't in the WZ data — they're server-side — so this is the *possibility*
 * of a drop, not its odds.
 */
export interface MobDropRecord {
  mobId: number;
  itemId: number;
}

/** A row from `mob_drops` joined to the item / equip's display name. */
export interface MobDropWithName extends MobDropRecord {
  itemName: string | null;
  /** `'item'` or `'equip'` — which detail page to link to. `null` if neither
   *  table has a matching id (e.g. the item entry hasn't been extracted). */
  entity: 'item' | 'equip' | null;
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
  /** Cooldown seconds between repeats; null when the quest is not repeatable. */
  repeatWait: number | null;
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
 *   - `item`  — give `amount` of item `targetId`
 *   - `exp`   — `amount` exp (targetId null)
 *   - `meso`  — `amount` mesos (targetId null)
 *   - `sp`    — `amount` skill points (targetId null)
 *   - `fame`  — `amount` fame, aka "pop" (targetId null)
 *   - `buff`  — apply buff itemId (targetId = buff itemId, amount null)
 *   - `skill` — grant skill (targetId = skill id, amount null)
 *
 * `idx` is the WZ child index for `item` rows (so two job-locked variants
 * sharing a `targetId` can both persist and stable-sort by position). For
 * non-item kinds there's only one row per kind and idx is 0.
 *
 * `prop`, `job`, `gender`, `period` only ever populate on `item` rows.
 * They mirror the WZ fields verbatim:
 *   - `prop`    weight in a random-reward pool (null = guaranteed)
 *   - `job`     job-restriction bitfield (null/0 = any job)
 *   - `gender`  0 = male, 1 = female (null or 2 = any)
 *   - `period`  expiration in minutes (null = permanent)
 */
export interface QuestRewardRecord {
  questId: number;
  kind: 'item' | 'exp' | 'meso' | 'sp' | 'fame' | 'buff' | 'skill';
  idx: number;
  targetId: number | null;
  amount: number | null;
  prop: number | null;
  job: number | null;
  gender: number | null;
  period: number | null;
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

/**
 * One row of the `quest_chains` table. A chain is a weakly-connected
 * component of the prerequisite graph with >= 2 quests; trivial isolated
 * quests are not persisted. See lib/questChains/graph.ts for derivation.
 */
export interface QuestChainRecord {
  id: number;
  name: string;
  representativeRootId: number;
  rootCount: number;
  size: number;
  maxDepth: number;
  hasCycles: boolean;
  cycleCount: number;
  parent: string | null;
}

/** One row of `quest_chain_members`. `sccId` is non-null iff the quest sits
 *  in a cycle within this chain (local index, 1..cycle_count). */
export interface QuestChainMemberRecord {
  chainId: number;
  questId: number;
  depth: number;
  sccId: number | null;
  isRoot: boolean;
  /** True iff this quest is on a path from a starting quest to the chain's
   *  final (deepest) quest. False marks it as optional — visible in the
   *  chain but skippable when racing toward the final. See
   *  `lib/questChains/graph.ts` for the derivation. */
  isCritical: boolean;
}

/** Member row joined to the underlying quest's display name, parent, and
 *  required level — the shape the detail page consumes. `requiredLevel` is
 *  carried so the aside can derive the chain's start/end level barriers
 *  without N follow-up quest queries. */
export interface QuestChainMemberWithName extends QuestChainMemberRecord {
  questName: string;
  questParent: string | null;
  questRequiredLevel: number | null;
}

/** One row of `quest_chain_edges`. */
export interface QuestChainEdgeRecord {
  chainId: number;
  fromQuestId: number;
  toQuestId: number;
  inCycle: boolean;
}

/** One row of `quest_chain_external_edges` — a prereq edge that crosses
 *  the parent-bounded chain boundary. `direction` is from the row's
 *  `chainId` perspective: `'in'` = the external quest gates one of this
 *  chain's quests; `'out'` = one of this chain's quests gates an external
 *  quest. `externalChainId` is nullable when the external quest isn't in
 *  any chain (size-1 WCC). */
export interface QuestChainExternalEdgeRecord {
  chainId: number;
  direction: 'in' | 'out';
  internalQuestId: number;
  externalQuestId: number;
  externalChainId: number | null;
}

/** External edge joined to the external quest's display name and the
 *  external chain's name (when the chain exists). */
export interface QuestChainExternalEdgeWithName extends QuestChainExternalEdgeRecord {
  externalQuestName: string | null;
  externalChainName: string | null;
}

/** Hydrated chain shape used by the detail route + graph viewer. */
export interface QuestChainDetail {
  chain: QuestChainRecord;
  members: QuestChainMemberWithName[];
  edges: QuestChainEdgeRecord[];
  externalEdges: QuestChainExternalEdgeWithName[];
}

/** Listing row + a small preview of members for the index. */
export interface QuestChainListRow extends QuestChainRecord {
  /** First few members in depth/name order — used for the index's "starts
   *  with …" hint column. Length <= 3. */
  preview: QuestSummary[];
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
  /** Which on-disk format the library was built from. `'wz'` for pre-v18 rows. */
  sourceKind: 'wz' | 'img';
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
  /**
   * Revision of the extracted-data contract that produced the current rows
   * (see db/dataVersion.ts). 0 means the library predates revision tracking and
   * must be rebuilt. Independent of `schemaVersion`.
   */
  dataRevision: number;
  /**
   * True when an incompatible cache was destructively cleared on open/import
   * and no successful rebuild has happened since. Tells a "must rebuild" empty
   * library apart from a genuine first run.
   */
  pendingRebuild: boolean;
  backend: 'opfs' | 'memory';
  /**
   * Short, user-facing explanation of why the in-memory fallback was used.
   * Null when `backend === 'opfs'` or when no fallback diagnosis is
   * available. Surfaced in the sidebar tooltip and Settings page.
   */
  fallbackReason: string | null;
  counts: {
    items: number;
    equips: number;
    mobs: number;
    npcs: number;
    maps: number;
    quests: number;
    questChains: number;
    datasets: number;
  };
}

/**
 * Boundary contract for the DB layer. Implementations may be the in-worker
 * SQLite-WASM instance (browser) or a hand-driver wrapping better-sqlite3 in
 * Node tests later.
 */
export type SortDir = 'asc' | 'desc';

/** Single page of a list query plus the total row count under the same filters. */
export interface PageResult<T> {
  rows: T[];
  total: number;
}

/**
 * Per-column filter value sent from the UI.
 *
 * - `string`: case-insensitive match on the column. `mode` selects how
 *   the value joins the column — `contains` is the default; `prefix` /
 *   `suffix` / `equals` switch the implicit `%` placement (none for
 *   equals).
 * - `enum`: equality against one of a fixed set. `values` is non-empty
 *   (an empty list means the filter isn't surfaced); multiple values
 *   become an `IN` clause in SQL — `Element is one of Fire, Ice`.
 * - `range`: number bounds. Either side may be omitted; `min === max`
 *   collapses to an exact equality.
 */
export type StringFilterMode = 'contains' | 'prefix' | 'suffix' | 'equals';

export type ColumnFilter =
  | { kind: 'string'; mode: StringFilterMode; value: string }
  | { kind: 'enum'; values: string[] }
  | { kind: 'range'; min?: number; max?: number };

/**
 * Common opts shared by the paginated list APIs. `orderBy` is a public
 * column id (e.g. `'level'`, `'requiredLevel'`) validated by the
 * implementation against a per-entity allowlist — unknown ids fall back
 * to that entity's default sort. `filters` is keyed by the same public
 * column ids; unknown keys are silently ignored.
 */
export interface ListOptsBase {
  /** Page size. Default 50; clamped to 1..500. */
  limit?: number;
  /** Page offset in rows. Default 0; clamped >= 0. */
  offset?: number;
  search?: string;
  orderBy?: string;
  dir?: SortDir;
  filters?: Record<string, ColumnFilter>;
}

export interface GameDatabase {
  open(): Promise<DbStatus>;
  status(): Promise<DbStatus>;

  upsertItem(item: ItemRecord): Promise<void>;
  upsertItems(items: ItemRecord[]): Promise<number>;
  getItem(id: number): Promise<ItemRecord | null>;
  listItems(opts?: ListOptsBase & { category?: string }): Promise<PageResult<ItemRecord>>;
  /** Distinct non-null `category` values for filter UIs / sidebar nav. */
  listItemCategories(): Promise<string[]>;
  /** Top item categories by member count for the home-page browse tile. */
  listItemCategoryCounts(limit?: number): Promise<CategoryCount[]>;
  /** Just the persisted icon bytes for an item, or null. */
  getItemIcon(id: number): Promise<Uint8Array | null>;

  upsertEquip(equip: EquipRecord): Promise<void>;
  upsertEquips(equips: EquipRecord[]): Promise<number>;
  getEquip(id: number): Promise<EquipRecord | null>;
  listEquips(
    opts?: ListOptsBase & {
      slot?: string;
      /**
       * Restrict to weapons (`equip_type IS NOT NULL`) or non-weapon
       * equips (`equip_type IS NULL`). Default unset returns every row.
       */
      kind?: 'equip' | 'weapon';
    },
  ): Promise<PageResult<EquipRecord>>;
  /** Distinct non-null `slot` values for filter UIs / sidebar nav. */
  listEquipSlots(): Promise<string[]>;
  /** Distinct non-null `equip_type` values, for the Weapons sidebar nav. */
  listEquipTypes(): Promise<string[]>;
  /** Top equip slots (e.g. Overall, Cap) by member count. */
  listEquipSlotCounts(limit?: number): Promise<CategoryCount[]>;
  /** Equip count grouped into exclusive class buckets (see EquipJobBucket). */
  listEquipJobCounts(): Promise<EquipJobCount[]>;
  getEquipIcon(id: number): Promise<Uint8Array | null>;

  upsertMobs(mobs: MobRecord[]): Promise<number>;
  getMob(id: number): Promise<MobRecord | null>;
  listMobs(opts?: ListOptsBase): Promise<PageResult<MobRecord>>;
  /** Mob count grouped into level bands of `bandSize` (default 10). */
  listMobLevelBandCounts(bandSize?: number): Promise<LevelBandCount[]>;
  /** Mob count for the home page's three "browse by level" buckets
   *  (30-70 / 70-120 / 120+). Bounds are inclusive; see implementation
   *  note in the query for why edge mobs overlap two buckets. */
  listMobLevelBucketCounts(): Promise<CategoryCount[]>;
  /** Decoded PNG bytes for the mob's stand sprite, or null. */
  getMobIcon(id: number): Promise<Uint8Array | null>;
  /** Items this mob can drop (from MonsterBook.img), joined to the target's name. */
  getMobDrops(mobId: number): Promise<MobDropWithName[]>;
  /** Maps where this mob spawns, with the per-map aggregated spawn count. */
  getMobMaps(mobId: number): Promise<MobMapAppearance[]>;
  /** Mobs that drop the given item, joined to mob name + level. */
  getItemDroppedBy(
    itemId: number,
  ): Promise<{ mobId: number; name: string; level: number | null }[]>;
  /** Replace `mob_drops` rows for the affected mob IDs in one transaction. */
  replaceMobDrops(drops: MobDropRecord[]): Promise<void>;

  upsertNpcs(npcs: NpcRecord[]): Promise<number>;
  getNpc(id: number): Promise<NpcRecord | null>;
  listNpcs(opts?: ListOptsBase): Promise<PageResult<NpcRecord>>;
  /** Maps where this NPC appears. */
  getNpcMaps(npcId: number): Promise<MapRecord[]>;
  /** Decoded PNG bytes for the NPC's stand sprite, or null. */
  getNpcIcon(id: number): Promise<Uint8Array | null>;

  upsertMaps(maps: MapRecord[]): Promise<number>;
  getMap(id: number): Promise<MapRecord | null>;
  listMaps(opts?: ListOptsBase): Promise<PageResult<MapRecord>>;
  /** Top map regions (street_name) by map count for the home-page browse
   *  tile. NULL/empty street names are dropped. */
  listMapStreetCounts(limit?: number): Promise<CategoryCount[]>;
  /** Decoded PNG bytes for the map minimap, or null. */
  getMapMinimap(id: number): Promise<Uint8Array | null>;
  /** NPCs + mobs + portals attached to a single map. */
  getMapNpcs(mapId: number): Promise<MapNpcWithName[]>;
  getMapMobs(mapId: number): Promise<MapMobWithName[]>;
  getMapPortals(mapId: number): Promise<MapPortalWithName[]>;
  /** Per-spawn mob rows (one per spawn point, not aggregated by mob id). */
  getMapMobSpawns(mapId: number): Promise<MapMobSpawnWithName[]>;

  upsertQuests(quests: QuestRecord[]): Promise<number>;
  getQuest(id: number): Promise<QuestRecord | null>;
  listQuests(opts?: ListOptsBase & { parent?: string }): Promise<PageResult<QuestRecord>>;
  /** Distinct quest `parent` values for filter UIs. */
  listQuestParents(): Promise<string[]>;
  /** Quest count grouped into required-level bands of `bandSize` (default 10). */
  listQuestLevelBandCounts(bandSize?: number): Promise<LevelBandCount[]>;
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

  /**
   * Derive quest chains from the current `quest_requirements` rows and
   * overwrite the chain tables. Idempotent — re-runs after every
   * extraction. Returns the number of chains persisted (size >= 2).
   */
  computeAndStoreQuestChains(): Promise<number>;
  /** Hydrated chain shape for the detail page + graph viewer. */
  getQuestChain(id: number): Promise<QuestChainDetail | null>;
  /** Paged listing for the chain index. `preview` carries the first few
   *  member quests so the index can show a "starts with …" hint. */
  listQuestChains(
    opts?: ListOptsBase & { parent?: string },
  ): Promise<PageResult<QuestChainListRow>>;
  /** Distinct chain `parent` values for the index filter dropdown. */
  listQuestChainParents(): Promise<string[]>;
  /** Chain a given quest belongs to, or null. A quest is in at most one. */
  getChainForQuest(questId: number): Promise<QuestChainRecord | null>;

  /** Replace all rows of a join table for the given map IDs. Used by the
   *  map extractor to keep join data consistent with re-extractions. */
  replaceMapLife(rows: {
    npcs: MapNpcRecord[];
    mobs: MapMobRecord[];
    portals: MapPortalRecord[];
    mobSpawns: MapMobSpawnRecord[];
  }): Promise<void>;

  /** Names + IDs of all entities for the in-app search index. */
  listSearchEntries(): Promise<SearchEntry[]>;

  /**
   * Batched (id, name) lookup for a single entity table. Ids that aren't
   * present in the table are simply omitted from the result — callers
   * use this gap to render "tombstone" rows for collection members whose
   * underlying entity hasn't been loaded into the game DB.
   */
  getEntitySummariesByIds(entityType: EntityKind, ids: readonly number[]): Promise<EntitySummary[]>;

  recordDataset(input: {
    label: string;
    wzVersion: string;
    /** Which on-disk format the library was built from. Defaults to `'wz'`. */
    sourceKind?: 'wz' | 'img';
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

  /** The selected server profile's id (singleton row). */
  getServerProfile(): Promise<string>;
  /** Set the selected server profile by id. */
  setServerProfile(profileId: string): Promise<void>;

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

export type EntityKind = 'item' | 'equip' | 'mob' | 'npc' | 'map' | 'quest' | 'questChain';

export interface SearchEntry {
  id: number;
  name: string;
  entity: EntityKind;
  category: string | null;
}

/**
 * Minimal (id, name) tuple used by cross-DB joins — e.g. enriching a
 * collection's polymorphic members with display names. Kept narrow so the
 * call doesn't pay icon-blob transfer cost when the consumer only needs a
 * label.
 */
export interface EntitySummary {
  id: number;
  name: string;
}

/** Aggregate row used by the home-page "browse by …" widgets. `key` is the
 *  filter value (a category, slug, or street_name) and `count` is the row
 *  total for that key. */
export interface CategoryCount {
  key: string;
  count: number;
}

/** Aggregate row for level-banded histograms. `band` is the lower bound of
 *  the band; e.g. `band: 10` with `bandSize: 10` covers levels 10..19. */
export interface LevelBandCount {
  band: number;
  count: number;
}

/** Exclusive job bucket for the equip-by-class donut. Buckets sum to the
 *  total equip count: an equip with no restriction lands in `any`, an equip
 *  restricted to exactly one class lands in that class's bucket, and an
 *  equip restricted to more than one class lands in `multi`. */
export type EquipJobBucket =
  | 'any'
  | 'warrior'
  | 'magician'
  | 'bowman'
  | 'thief'
  | 'pirate'
  | 'beginner'
  | 'multi';

export interface EquipJobCount {
  job: EquipJobBucket;
  count: number;
}
