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
  /** Where the localized name/description was resolved from in String.wz. */
  stringPath: string;
  /** The String.wz bucket node the strings sat under (item category); null for flat layouts. */
  stringCategory: string | null;
}

/**
 * Chair-specific metadata for Install items whose .img carries an `effect`
 * subtree. A chair row exists in addition to the generic items row — chair
 * detail pages query both. The pre-rendered animated preview lives here as a
 * BLOB, alongside its dimensions so the UI can size the `<img>` before the
 * blob URL resolves.
 */
export interface ChairRecord {
  itemId: number;
  recoveryHp: number | null;
  recoveryMp: number | null;
  frameCount: number;
  /** Animated PNG (APNG) bytes. Always populated — a chair without a preview
   *  is not persisted. */
  previewData: Uint8Array;
  previewWidth: number;
  previewHeight: number;
}

/**
 * An item list row: an {@link ItemRecord} plus a small, common subset of
 * consumable `spec` effects that `listItems` LEFT JOINs in so the items table
 * can show, sort, and filter by them. Every effect field is null for
 * non-consumables. `getItem` does not join, so these only carry values when the
 * row comes from `listItems`.
 */
export interface ItemListRow extends ItemRecord {
  /** Flat HP restored (`spec.hp`). */
  recoveryHp: number | null;
  /** Flat MP restored (`spec.mp`). */
  recoveryMp: number | null;
  /** Buff duration in whole seconds (`spec.time` ÷ 1000). */
  buffDurationSeconds: number | null;
  /** Weapon Attack buff (`spec.pad`). */
  buffWeaponAttack: number | null;
  /** Speed buff (`spec.speed`). */
  buffSpeed: number | null;
  /** Jump buff (`spec.jump`). */
  buffJump: number | null;
}

/** One weighted entry of a `morphRandom` table: transform into `morph` with
 *  relative weight `prop`. */
export interface MorphRandomEntry {
  morph: number;
  prop: number;
}

/** One spawn entry of a summoning sack's `mob` table: spawn mob `mobId` with
 *  `prob`% chance. The same id may repeat — each entry is one spawn. */
export interface SummonMobEntry {
  mobId: number;
  prob: number;
}

/**
 * Consumable `spec` metadata for a "use" item — what happens when it's
 * consumed. A sidecar row keyed by `item_id` (FK into items), present only
 * for items that carry a `/spec` subtree, so non-consumable items don't pay
 * for ~60 nullable columns they'll never use.
 *
 * Every scalar field mirrors a raw WZ `spec` key and is null when absent.
 * Letter-coded fields (`defenseAtt`, `defenseState`) are stored verbatim and
 * decoded for display; the three list-shaped keys are kept as parsed arrays.
 */
export interface ConsumableSpecRecord {
  itemId: number;
  // Recovery
  hp: number | null;
  mp: number | null;
  /** HP restored as a percentage of max HP (`hpR`). */
  hpR: number | null;
  /** MP restored as a percentage of max MP (`mpR`). */
  mpR: number | null;
  mhp: number | null;
  mhpR: number | null;
  mmpR: number | null;
  mhpRRate: number | null;
  mmpRRate: number | null;
  // Timed buffs — paired with `time` (duration in ms)
  time: number | null;
  pad: number | null;
  mad: number | null;
  pdd: number | null;
  mdd: number | null;
  acc: number | null;
  eva: number | null;
  speed: number | null;
  jump: number | null;
  luk: number | null;
  padRate: number | null;
  madRate: number | null;
  pddRate: number | null;
  mddRate: number | null;
  accRate: number | null;
  evaRate: number | null;
  speedRate: number | null;
  // Cures / status (1 = cures the named ailment)
  curse: number | null;
  darkness: number | null;
  poison: number | null;
  seal: number | null;
  weakness: number | null;
  thaw: number | null;
  barrier: number | null;
  respectPimmune: number | null;
  respectMimmune: number | null;
  respectFs: number | null;
  // Monster cards — `prob` is the magnitude (%) of the defense/bonus effect
  /** Elemental-attack defense code: F=Fire, I=Ice, L=Lightning, S=Poison. */
  defenseAtt: string | null;
  /** Status-ailment defense code: C=Curse, D=Darkness, P=Poison, S=Seal,
   *  W=Weakness, F=Freeze. */
  defenseState: string | null;
  prob: number | null;
  // Drop / meso bonuses
  itemupbyitem: number | null;
  mesoupbyitem: number | null;
  itemCode: number | null;
  itemRange: number | null;
  // Transform
  morph: number | null;
  ghost: number | null;
  // Teleport
  moveTo: number | null;
  returnMapQr: number | null;
  ignoreContinent: number | null;
  randomMoveInFieldSet: number | null;
  // Summon
  npc: number | null;
  attackMobId: number | null;
  attackIndex: number | null;
  // Pet / mount
  /** Pet fullness restored (pet food). */
  inc: number | null;
  /** Mount fatigue change (negative feeds the mount). */
  incFatigue: number | null;
  // EXP / events
  exp: number | null;
  expinc: number | null;
  expBuff: number | null;
  maxLevelBuff: number | null;
  /** Monster Carnival points. */
  cp: number | null;
  eventPoint: number | null;
  eventRate: number | null;
  // Pickup / misc flags
  consumeOnPickup: number | null;
  onlyPickup: number | null;
  runOnPickup: number | null;
  repeatEffect: number | null;
  otherParty: number | null;
  party: number | null;
  // List-shaped keys
  /** Mob ids referenced by `spec/mob` (e.g. a shield's associated mob). */
  mob: number[] | null;
  /** Summoning-sack spawn table (item-level `mob`: `{ id, prob }` entries). */
  summonMobs: SummonMobEntry[] | null;
  /** Weighted random-transform table (`morphRandom`). */
  morphRandom: MorphRandomEntry[] | null;
  /** Skill ids a mastery book can teach (the `0`–`9` keys). */
  skillbook: number[] | null;
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
  /** Where the localized name/description was resolved from in String.wz. */
  stringPath: string;
  /** The String.wz `Eqp` bucket the strings sat under (e.g. "Accessory"); null if absent. */
  stringCategory: string | null;
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
  /**
   * Name of this map's region mark (`info/mapMark`), keying into `map_marks`
   * for its icon. Null when the map has no mark or names one with no icon
   * (e.g. the sentinel `"None"`).
   */
  mapMark: string | null;
  sourcePath: string;
}

/**
 * A region-mark icon shared across maps. Stored once per `name`
 * (Map.wz/MapHelper.img/mark/<name>) and referenced by `MapRecord.mapMark`.
 */
export interface MapMarkRecord {
  name: string;
  iconData: Uint8Array;
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

/**
 * A `map_portals` row joined back to its *source* map's display name — the
 * reverse of {@link MapPortalWithName}. Used to answer "which maps have a
 * portal that leads into this one", so a visitor can find a way in.
 */
export interface InboundMapPortal extends MapPortalRecord {
  sourceMapName: string | null;
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
 * An item whose summoning-sack spawn table includes a given mob — the reverse
 * of {@link SummonMobEntry}. `spawnCount` is how many of the mob the item
 * spawns; `prob` is the spawn chance (usually 100).
 */
export interface MobSummonSource {
  itemId: number;
  name: string;
  spawnCount: number;
  prob: number | null;
}

/**
 * An overview world map (one `Map.wz/WorldMap/WorldMap*.img`). `originX`/
 * `originY` come from the `BaseImg/0` canvas origin; marker/screen coords are
 * projected at render as `origin + wz`. `parentId` references another
 * world map's `id` for up-navigation.
 */
export interface WorldMapRecord {
  id: string;
  parentId: string | null;
  /** Decoded PNG bytes for the `BaseImg/0` background, or null. */
  baseImageData: Uint8Array | null;
  originX: number;
  originY: number;
  sourcePath: string;
}

/** A clickable marker on a world map (one `MapList/<index>` entry). */
export interface WorldMapMarkerRecord {
  /** `"<worldMapId>:<markerIndex>"`. */
  id: string;
  worldMapId: string;
  markerIndex: number;
  /** Raw origin-relative spot coords; screen pos is `origin + wz`. */
  wzX: number;
  wzY: number;
  type: number | null;
  title: string | null;
  description: string | null;
}

/** One map id grouped under a marker (one `MapList/<index>/mapNo/<i>` entry). */
export interface WorldMapMarkerMapRecord {
  markerId: string;
  mapId: number;
  mapIndex: number;
}

/** A marker with its grouped map ids attached, for rendering. */
export interface WorldMapMarkerWithMaps extends WorldMapMarkerRecord {
  mapIds: number[];
}

/** A clickable image overlay linking one world map to another (a `MapLink`
 *  entry). Drawn at `baseOrigin - origin`; the whole image is the hit target. */
export interface WorldMapLinkRecord {
  /** `"<sourceWorldMapId>:<linkIndex>"`. */
  id: string;
  sourceWorldMapId: string;
  targetWorldMapId: string;
  linkIndex: number;
  tooltip: string | null;
  /** Decoded PNG bytes for the `linkImg` overlay, or null. */
  imageData: Uint8Array | null;
  originX: number;
  originY: number;
  z: number;
}

/** A placement of a map on a world map: which world map, which marker, and
 *  the marker's region title (for labelling the switcher). A map can have
 *  several — it may appear on more than one world map. `depth` is the
 *  placement's distance from the root of the `parentMap` hierarchy; the
 *  deepest placement is the most specific (leaf) world map for the map. */
export interface WorldMapForMap {
  worldMapId: string;
  markerId: string;
  markerTitle: string | null;
  depth: number;
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
  /** Denormalized scalar completion rewards. 0 means "no reward of this kind"
   *  in the extracted data; null means the row predates the reward columns
   *  and hasn't been re-extracted yet. */
  rewardExp: number | null;
  rewardMeso: number | null;
  rewardFame: number | null;
  sourcePath: string;
}

/**
 * A character job. Identity comes from `String.wz/Job.img/<id>` and the
 * hierarchy is encoded in the id itself — `Math.floor(id / 100) * 100` is
 * the base job (Beginner=0, Warrior=100, Magician=200, ...), and `id`
 * below 100 is always a Beginner variant. Stored as a small reference
 * table — populated whenever Skill.wz is loaded — so skill rows can
 * display "Hero" instead of "Job 112".
 */
export interface JobRecord {
  id: number;
  name: string;
  /** Branch root id — same as `id` for base jobs (0/100/200/...). */
  baseJobId: number;
}

/**
 * A character skill. Identity comes from `String.wz/Skill.img/<id>` and the
 * static metadata from `Skill.wz/<jobId>.img/skill/<id>/common`. The level
 * table and prerequisite list live in {@link SkillLevelRecord} and
 * {@link SkillPrerequisiteRecord} rows keyed by `id`.
 *
 * `element` and `requiredWeapon` are stored verbatim — single-character
 * codes like `"F"`/`"I"` and a numeric weapon-type code as a string — so
 * the decoder in `domain/skillElements.ts` is the only place that needs
 * to know the encoding. Unknown future codes still round-trip cleanly.
 */
export interface SkillRecord {
  id: number;
  /** Job that owns the skill (the integer `<jobId>` in `<jobId>.img`). */
  jobId: number;
  name: string | null;
  description: string | null;
  /** Tooltip text from `String.wz/Skill.img/<id>/h ?? h1 ?? h2`. */
  tooltip: string | null;
  maxLevel: number | null;
  /**
   * Optional master-level cap (only meaningful for ultimate / 4th-job
   * skills where `masterLevel < maxLevel` until raised in-game).
   */
  masterLevel: number | null;
  /** Raw element code (e.g. `"F"`). Decode via `decodeSkillElement`. */
  element: string | null;
  /** Raw `weapon` code, stored as a string. Decode via `decodeRequiredWeapon`. */
  requiredWeapon: string | null;
  /** WZ path the icon sprite came from. */
  iconPath: string | null;
  /** Decoded PNG bytes for the skill icon, or null. */
  iconData: Uint8Array | null;
  sourcePath: string;
}

/**
 * One row of a skill's level table. Every stat field is nullable — different
 * skill archetypes touch different fields, so an attack skill carries
 * `damagePercent` while a buff skill carries `pad`/`mad`. Keys we don't yet
 * surface as columns are preserved in `rawJson` for forward compatibility.
 */
export interface SkillLevelRecord {
  skillId: number;
  level: number;
  mpCost: number | null;
  hpCost: number | null;
  damagePercent: number | null;
  /** WZ `attackCount`. Number of hits per cast. */
  hits: number | null;
  /** WZ `mobCount`. Number of targets the skill can hit. */
  targets: number | null;
  /** WZ `time`. Duration of the skill's effect, in seconds. */
  durationSeconds: number | null;
  /** WZ `cooltime`. Cooldown between casts, in seconds. */
  cooldownSeconds: number | null;
  /** WZ `prop`. Success chance, as a percentage. */
  chancePercent: number | null;
  x: number | null;
  y: number | null;
  z: number | null;
  /** Weapon attack bonus (`pad`). */
  pad: number | null;
  /** Magic attack bonus (`mad`). */
  mad: number | null;
  /** Weapon defense bonus (`pdd`). */
  pdd: number | null;
  /** Magic defense bonus (`mdd`). */
  mdd: number | null;
  acc: number | null;
  eva: number | null;
  speed: number | null;
  jump: number | null;
  hp: number | null;
  mp: number | null;
  /** Percent HP buff (`hpR`). */
  hpPercent: number | null;
  /** Percent MP buff (`mpR`). */
  mpPercent: number | null;
  /**
   * Static per-level description from older WZ dumps (`h<level>`). When set,
   * the UI shows this verbatim instead of rendering the parent skill's
   * templated `tooltip`. Null when the data uses the modern template style.
   */
  description: string | null;
  /** JSON-encoded object of WZ keys we don't yet promote to columns. */
  rawJson: string | null;
}

/**
 * One skill the parent skill requires before it can be learned. The
 * `requiredSkillId` must be at least `requiredLevel` before this skill
 * unlocks. Composite PK is `(skillId, requiredSkillId)`.
 */
export interface SkillPrerequisiteRecord {
  skillId: number;
  requiredSkillId: number;
  requiredLevel: number;
}

/** A `skill_prerequisites` row joined to the required skill's display name. */
export interface SkillPrerequisiteWithName extends SkillPrerequisiteRecord {
  requiredSkillName: string | null;
}

/** Summary surfaced from a cross-link (e.g. "skills this quest grants"). */
export interface SkillSummary {
  id: number;
  name: string | null;
  jobId: number;
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
 *  display name. Targets may be null for `level` / `job` kinds. For
 *  `questPre` kind, `targetLevel` carries the prerequisite quest's own
 *  `required_level` so callers can render it on the row. */
export interface QuestRequirementWithName extends QuestRequirementRecord {
  targetName: string | null;
  targetLevel: number | null;
}

/** A row from `quest_rewards` joined to the target item's display name.
 *  `targetEntity` reflects which table (items vs equips) actually owns the
 *  target id — `kind='item'` rewards cover both, so the UI needs this to
 *  pick the right detail-page link and icon. Null when the id matched
 *  neither (extraction gap) or the row isn't an item-shaped reward. */
export interface QuestRewardWithName extends QuestRewardRecord {
  targetName: string | null;
  targetEntity: 'item' | 'equip' | null;
}

/** Quest summary surfaced from a cross-link (e.g. "quests this NPC offers"). */
export interface QuestSummary {
  id: number;
  name: string;
  parent: string | null;
  requiredLevel: number | null;
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
  /**
   * Verbose diagnostics behind the in-memory fallback — raw error plus the
   * capability probe. Null when `backend === 'opfs'`. Shown only in the
   * "Advanced" disclosure of the storage-unavailable screen.
   */
  fallbackDetail: string | null;
  counts: {
    items: number;
    equips: number;
    mobs: number;
    npcs: number;
    maps: number;
    worldMaps: number;
    quests: number;
    questChains: number;
    skills: number;
    jobs: number;
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

/**
 * Which hosted dataset version is currently installed, recorded after a fixed
 * deployment installs one. Lets startup compare the installed version against
 * the repository's resolved `latest` and offer an update. Absent on the generic
 * deployment and before the first install.
 */
export interface InstalledDatasetRecord {
  id: string;
  family: string;
  version: string;
  displayName: string;
  /** Server profile pinned for this dataset. */
  serverProfileId: string;
  /** ISO timestamp of when this version was installed. */
  installedAt: string;
}

export interface GameDatabase {
  open(): Promise<DbStatus>;
  status(): Promise<DbStatus>;

  upsertItem(item: ItemRecord): Promise<void>;
  upsertItems(items: ItemRecord[]): Promise<number>;
  getItem(id: number): Promise<ItemRecord | null>;
  listItems(opts?: ListOptsBase & { category?: string }): Promise<PageResult<ItemListRow>>;
  /** Distinct non-null `category` values for filter UIs / sidebar nav. */
  listItemCategories(): Promise<string[]>;
  /** Top item categories by member count for the home-page browse tile. */
  listItemCategoryCounts(limit?: number): Promise<CategoryCount[]>;
  /** Just the persisted icon bytes for an item, or null. */
  getItemIcon(id: number): Promise<Uint8Array | null>;

  /** Persist chair-specific metadata + pre-rendered preview for Install items
   *  whose .img carries an `effect` subtree. Item rows must already exist —
   *  chairs.item_id FKs into items.id. */
  upsertChairs(chairs: ChairRecord[]): Promise<number>;
  /** Returns null for items that aren't chairs. */
  getChair(itemId: number): Promise<ChairRecord | null>;

  /** Persist consumable `spec` rows. Item rows must already exist —
   *  consumable_specs.item_id FKs into items.id. */
  upsertConsumableSpecs(specs: ConsumableSpecRecord[]): Promise<number>;
  /** Returns null for items with no extracted `spec`. */
  getConsumableSpec(itemId: number): Promise<ConsumableSpecRecord | null>;

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
  getEquipIcon(id: number): Promise<Uint8Array | null>;

  upsertMobs(mobs: MobRecord[]): Promise<number>;
  getMob(id: number): Promise<MobRecord | null>;
  listMobs(opts?: ListOptsBase): Promise<PageResult<MobRecord>>;
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
  /** Items whose summon table spawns this mob (reverse of consumable summonMobs). */
  getMobSummonedFrom(mobId: number): Promise<MobSummonSource[]>;
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
  /** Store the shared region-mark icons (deduplicated by name). */
  upsertMapMarks(marks: MapMarkRecord[]): Promise<number>;
  /** Decoded PNG bytes for the map's region-mark icon, or null. */
  getMapMark(id: number): Promise<Uint8Array | null>;
  /** NPCs + mobs + portals attached to a single map. */
  getMapNpcs(mapId: number): Promise<MapNpcWithName[]>;
  getMapMobs(mapId: number): Promise<MapMobWithName[]>;
  getMapPortals(mapId: number): Promise<MapPortalWithName[]>;
  /** Portals on *other* maps whose target is this map (reverse of getMapPortals). */
  getMapPortalsInto(mapId: number): Promise<InboundMapPortal[]>;
  /** Per-spawn mob rows (one per spawn point, not aggregated by mob id). */
  getMapMobSpawns(mapId: number): Promise<MapMobSpawnWithName[]>;

  upsertWorldMaps(worldMaps: WorldMapRecord[]): Promise<number>;
  upsertWorldMapMarkers(markers: WorldMapMarkerRecord[]): Promise<number>;
  upsertWorldMapMarkerMaps(rows: WorldMapMarkerMapRecord[]): Promise<number>;
  upsertWorldMapLinks(links: WorldMapLinkRecord[]): Promise<number>;
  /** A world map incl. its decoded background PNG, or null. */
  getWorldMap(id: string): Promise<WorldMapRecord | null>;
  /** Markers for a world map, each with its grouped map ids attached. */
  getWorldMapMarkers(worldMapId: string): Promise<WorldMapMarkerWithMaps[]>;
  /** Clickable links from a world map to others, ordered by z then index. */
  getWorldMapLinks(worldMapId: string): Promise<WorldMapLinkRecord[]>;
  /** Every world map placement of a map (one per containing marker). */
  findWorldMapsForMap(mapId: number): Promise<WorldMapForMap[]>;

  upsertJobs(jobs: JobRecord[]): Promise<number>;
  getJob(id: number): Promise<JobRecord | null>;
  /** Every job, ordered by id ascending. Cheap (≤ ~50 rows) — clients
   *  fetch the whole table and build their own id → name map. */
  listJobs(): Promise<JobRecord[]>;

  upsertSkills(skills: SkillRecord[]): Promise<number>;
  getSkill(id: number): Promise<SkillRecord | null>;
  listSkills(opts?: ListOptsBase): Promise<PageResult<SkillRecord>>;
  /** Decoded PNG bytes for the skill icon, or null. */
  getSkillIcon(id: number): Promise<Uint8Array | null>;
  /** Level table rows for one skill, ordered by level ascending. */
  getSkillLevels(skillId: number): Promise<SkillLevelRecord[]>;
  /** Direct prerequisites of a skill, joined to the required skill's name. */
  getSkillPrerequisites(skillId: number): Promise<SkillPrerequisiteWithName[]>;
  /** Skills that list `skillId` as a prerequisite — the inverse lookup. */
  getSkillsRequiring(skillId: number): Promise<SkillPrerequisiteWithName[]>;
  /** Quests that grant the given skill as a reward. */
  getSkillQuests(skillId: number): Promise<QuestSummary[]>;
  /** Replace a skill's level + prereq rows in one transaction. */
  replaceSkillRelations(rows: {
    levels: SkillLevelRecord[];
    prerequisites: SkillPrerequisiteRecord[];
  }): Promise<void>;

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
  /** Quests that hand the given item out as a reward. Backs both ItemDetail
   *  and EquipDetail since item and equip IDs share one target-id space. */
  getItemRewardingQuests(itemId: number): Promise<QuestSummary[]>;
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

  /**
   * The inline server-profile config a fixed dataset installed, or null when
   * none is present (generic deployments keep their selection in the user DB).
   * Opaque JSON; validate with `serverProfileSchema` before use.
   */
  getActiveServerProfile(): Promise<unknown>;
  /** Persist a full server-profile config inline (fixed-dataset install). */
  setServerProfileConfig(profile: { id: string }): Promise<void>;

  /** The installed hosted dataset version, or null if none is recorded. */
  getInstalledDataset(): Promise<InstalledDatasetRecord | null>;
  /** Record the installed hosted dataset version (after a successful install). */
  setInstalledDataset(record: InstalledDatasetRecord): Promise<void>;

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

export type EntityKind =
  | 'item'
  | 'equip'
  | 'mob'
  | 'npc'
  | 'map'
  | 'quest'
  | 'questChain'
  | 'skill';

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
