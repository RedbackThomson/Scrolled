// Versioned SQL migrations.
//
// Each entry runs inside a single transaction. Add new migrations to the end;
// never edit or reorder existing ones. The runner stores the highest applied
// version in the `_migrations` table.

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      -- Entity tables ----------------------------------------------------

      CREATE TABLE items (
        id              INTEGER PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT,
        category        TEXT,
        subcategory     TEXT,
        icon_path       TEXT,
        price           INTEGER,
        stack_size      INTEGER,
        required_level  INTEGER,
        source_path     TEXT NOT NULL
      );

      CREATE INDEX items_name_idx ON items (name);
      CREATE INDEX items_category_idx ON items (category);

      CREATE TABLE equips (
        id              INTEGER PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT,
        slot            TEXT,
        category        TEXT,
        required_level  INTEGER,
        required_str    INTEGER,
        required_dex    INTEGER,
        required_int    INTEGER,
        required_luk    INTEGER,
        required_job    INTEGER,
        attack          INTEGER,
        magic_attack    INTEGER,
        defense         INTEGER,
        magic_defense   INTEGER,
        accuracy        INTEGER,
        avoidability    INTEGER,
        upgrade_slots   INTEGER,
        icon_path       TEXT,
        source_path     TEXT NOT NULL
      );

      CREATE INDEX equips_name_idx ON equips (name);
      CREATE INDEX equips_slot_idx ON equips (slot);

      CREATE TABLE mobs (
        id                    INTEGER PRIMARY KEY,
        name                  TEXT NOT NULL,
        level                 INTEGER,
        hp                    INTEGER,
        mp                    INTEGER,
        exp                   INTEGER,
        is_boss               INTEGER NOT NULL DEFAULT 0,
        element_attack        TEXT,
        element_defenses_json TEXT,
        source_path           TEXT NOT NULL
      );

      CREATE INDEX mobs_name_idx ON mobs (name);

      CREATE TABLE npcs (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        source_path TEXT NOT NULL
      );

      CREATE INDEX npcs_name_idx ON npcs (name);

      CREATE TABLE maps (
        id                   INTEGER PRIMARY KEY,
        name                 TEXT,
        street_name          TEXT,
        return_map_id        INTEGER,
        forced_return_map_id INTEGER,
        field_limit          INTEGER,
        mob_rate             REAL,
        source_path          TEXT NOT NULL
      );

      CREATE INDEX maps_name_idx ON maps (name);

      CREATE TABLE quests (
        id              INTEGER PRIMARY KEY,
        name            TEXT NOT NULL,
        start_npc_id    INTEGER,
        end_npc_id      INTEGER,
        required_level  INTEGER,
        required_job    INTEGER,
        source_path     TEXT NOT NULL
      );

      CREATE INDEX quests_name_idx ON quests (name);

      -- Join tables ------------------------------------------------------

      CREATE TABLE map_npcs (
        map_id INTEGER NOT NULL,
        npc_id INTEGER NOT NULL,
        x      INTEGER,
        y      INTEGER,
        PRIMARY KEY (map_id, npc_id, x, y)
      );

      CREATE INDEX map_npcs_npc_idx ON map_npcs (npc_id);

      CREATE TABLE map_mobs (
        map_id INTEGER NOT NULL,
        mob_id INTEGER NOT NULL,
        count  INTEGER,
        PRIMARY KEY (map_id, mob_id)
      );

      CREATE INDEX map_mobs_mob_idx ON map_mobs (mob_id);

      CREATE TABLE map_portals (
        map_id        INTEGER NOT NULL,
        portal_name   TEXT NOT NULL,
        target_map_id INTEGER,
        target_portal TEXT,
        x             INTEGER,
        y             INTEGER,
        PRIMARY KEY (map_id, portal_name)
      );

      CREATE INDEX map_portals_target_idx ON map_portals (target_map_id);

      CREATE TABLE quest_requirements (
        quest_id  INTEGER NOT NULL,
        kind      TEXT NOT NULL,
        target_id INTEGER,
        amount    INTEGER,
        PRIMARY KEY (quest_id, kind, target_id)
      );

      CREATE TABLE quest_rewards (
        quest_id  INTEGER NOT NULL,
        kind      TEXT NOT NULL,
        target_id INTEGER,
        amount    INTEGER,
        PRIMARY KEY (quest_id, kind, target_id)
      );

      -- Assets and datasets ----------------------------------------------

      CREATE TABLE assets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        source_path TEXT NOT NULL UNIQUE,
        kind        TEXT NOT NULL,
        width       INTEGER,
        height      INTEGER
      );

      CREATE TABLE datasets (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        label      TEXT NOT NULL,
        loaded_at  INTEGER NOT NULL,
        wz_version TEXT NOT NULL,
        notes      TEXT
      );

      CREATE TABLE dataset_files (
        dataset_id INTEGER NOT NULL,
        name       TEXT NOT NULL,
        size       INTEGER,
        PRIMARY KEY (dataset_id, name)
      );
    `,
  },
  {
    version: 2,
    name: 'persist decoded icons',
    sql: `
      ALTER TABLE items  ADD COLUMN icon_data BLOB;
      ALTER TABLE equips ADD COLUMN icon_data BLOB;
    `,
  },
  {
    version: 3,
    name: 'fingerprint loaded WZ files',
    sql: `
      ALTER TABLE dataset_files ADD COLUMN hash TEXT;
      CREATE INDEX IF NOT EXISTS dataset_files_hash_idx ON dataset_files (hash);
    `,
  },
  {
    version: 4,
    name: 'quest taxonomy fields',
    sql: `
      ALTER TABLE quests ADD COLUMN parent TEXT;
      ALTER TABLE quests ADD COLUMN description TEXT;
      CREATE INDEX IF NOT EXISTS quests_parent_idx ON quests (parent);
      CREATE INDEX IF NOT EXISTS quest_requirements_target_idx
        ON quest_requirements (kind, target_id);
      CREATE INDEX IF NOT EXISTS quest_rewards_target_idx
        ON quest_rewards (kind, target_id);
    `,
  },
  {
    version: 5,
    name: 'extraction outcome',
    sql: `
      -- One-shot run metrics on datasets so a quick "was the run good?"
      -- glance is a single row lookup.
      ALTER TABLE datasets ADD COLUMN total_ms INTEGER;
      ALTER TABLE datasets ADD COLUMN ok INTEGER;

      -- Per-file load outcome from parser.load. NULL on rows recorded
      -- before this migration; UI treats null as "loaded" optimistically.
      ALTER TABLE dataset_files ADD COLUMN load_status TEXT;
      ALTER TABLE dataset_files ADD COLUMN load_error TEXT;

      -- Per-extractor outcome. One row per (dataset, extractor) so the
      -- Settings panel can render a breakdown without re-deriving from
      -- log lines.
      CREATE TABLE extraction_extractors (
        dataset_id        INTEGER NOT NULL,
        extractor         TEXT NOT NULL,
        status            TEXT NOT NULL,
        rows              INTEGER NOT NULL DEFAULT 0,
        skipped_rows      INTEGER NOT NULL DEFAULT 0,
        placeholder_names INTEGER NOT NULL DEFAULT 0,
        error             TEXT,
        PRIMARY KEY (dataset_id, extractor)
      );
    `,
  },
  {
    version: 6,
    name: 'sprites for npcs, mobs, maps',
    sql: `
      -- Same shape as items.icon_data / equips.icon_data: the WZ path
      -- where the sprite came from (for debugging / re-extraction) plus
      -- the decoded PNG bytes the UI renders. NULL on rows that pre-date
      -- this migration; the next extraction backfills them.
      ALTER TABLE npcs ADD COLUMN icon_path    TEXT;
      ALTER TABLE npcs ADD COLUMN icon_data    BLOB;
      ALTER TABLE mobs ADD COLUMN icon_path    TEXT;
      ALTER TABLE mobs ADD COLUMN icon_data    BLOB;
      ALTER TABLE maps ADD COLUMN minimap_path TEXT;
      ALTER TABLE maps ADD COLUMN minimap_data BLOB;
    `,
  },
  {
    version: 7,
    name: 'indexes for browse-table sort columns',
    sql: `
      CREATE INDEX IF NOT EXISTS mobs_level_idx            ON mobs (level);
      CREATE INDEX IF NOT EXISTS mobs_hp_idx               ON mobs (hp);
      CREATE INDEX IF NOT EXISTS mobs_exp_idx              ON mobs (exp);
      CREATE INDEX IF NOT EXISTS equips_required_level_idx ON equips (required_level);
      CREATE INDEX IF NOT EXISTS equips_attack_idx         ON equips (attack);
      CREATE INDEX IF NOT EXISTS items_required_level_idx  ON items (required_level);
      CREATE INDEX IF NOT EXISTS maps_street_name_idx      ON maps (street_name);
      CREATE INDEX IF NOT EXISTS quests_required_level_idx ON quests (required_level);
    `,
  },
  {
    version: 8,
    name: 'mob drops from MonsterBook.img',
    sql: `
      -- Possible drops per mob, sourced from
      -- String.wz/MonsterBook.img/<mobId>/reward/<index>. The WZ data only
      -- records *which* items a mob can drop; rates/quantities are server-
      -- side. item_id can reference either items.id or equips.id; we don't
      -- FK-constrain it because the two tables share a numeric ID space
      -- and either side may not be loaded yet.
      CREATE TABLE mob_drops (
        mob_id  INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        PRIMARY KEY (mob_id, item_id)
      );

      CREATE INDEX IF NOT EXISTS mob_drops_item_idx ON mob_drops (item_id);
    `,
  },
  {
    version: 9,
    name: 'minimap geometry, portals with idx, per-spawn mob rows',
    sql: `
      -- Minimap geometry needed to translate game coords to minimap pixels:
      --   pixelX = (gameX + centerX) / mag
      --   pixelY = (gameY + centerY) / mag
      -- centerX/centerY/mag come from the WZ map's miniMap subnode siblings;
      -- width/height are the canvas dimensions. All five are needed to draw
      -- entity overlays on the minimap.
      ALTER TABLE maps ADD COLUMN minimap_center_x INTEGER;
      ALTER TABLE maps ADD COLUMN minimap_center_y INTEGER;
      ALTER TABLE maps ADD COLUMN minimap_width    INTEGER;
      ALTER TABLE maps ADD COLUMN minimap_height   INTEGER;
      ALTER TABLE maps ADD COLUMN minimap_mag      INTEGER;

      -- Rebuild map_portals from scratch.
      --   * adds an idx column (the WZ child index, e.g. portal/0, portal/1)
      --     so maps with multiple portals sharing a name -- most commonly
      --     several 'sp' spawn points -- all survive extraction;
      --   * PK becomes (map_id, idx) so duplicates by name no longer collide;
      --   * folds in portal_type (pt) and script so the viewer can bucket
      --     portals into spawn / external / internal-teleport layers.
      DROP TABLE map_portals;
      CREATE TABLE map_portals (
        map_id        INTEGER NOT NULL,
        idx           INTEGER NOT NULL,
        portal_name   TEXT NOT NULL,
        target_map_id INTEGER,
        target_portal TEXT,
        x             INTEGER,
        y             INTEGER,
        portal_type   INTEGER,
        script        TEXT,
        PRIMARY KEY (map_id, idx)
      );
      CREATE INDEX map_portals_target_idx ON map_portals (target_map_id);
      CREATE INDEX map_portals_name_idx ON map_portals (map_id, portal_name);

      -- One row per mob spawn point on a map. map_mobs keeps its aggregate
      -- (mob_id, count) shape for the list view; this table preserves the
      -- per-spawn (x, y) needed to render mob icons on the map viewer
      -- canvas. Duplicate (map_id, mob_id, x, y) rows are legal — two
      -- spawners can share a point — so no PK.
      CREATE TABLE map_mob_spawns (
        map_id INTEGER NOT NULL,
        mob_id INTEGER NOT NULL,
        x      INTEGER,
        y      INTEGER
      );

      CREATE INDEX map_mob_spawns_map_idx ON map_mob_spawns (map_id);
      CREATE INDEX map_mob_spawns_mob_idx ON map_mob_spawns (mob_id);
    `,
  },
  {
    version: 10,
    name: 'equip cash flag and equip-type slug',
    sql: `
      -- info/cash boolean from the WZ tree, surfaced so the UI can
      -- distinguish cosmetic cash-shop equips from regular in-game ones.
      -- Default 0 so pre-extraction rows aren't treated as cash items
      -- until the next run overwrites them.
      ALTER TABLE equips ADD COLUMN cash INTEGER NOT NULL DEFAULT 0;

      -- Resolved equip-type slug computed at extraction time from
      -- Math.floor(id / 10000) against a fixed lookup. NULL for buckets
      -- not in the lookup (today: every non-weapon), which is also the
      -- "is this a weapon?" predicate the Weapons routes filter on.
      ALTER TABLE equips ADD COLUMN equip_type TEXT;

      CREATE INDEX IF NOT EXISTS equips_cash_idx       ON equips (cash);
      CREATE INDEX IF NOT EXISTS equips_equip_type_idx ON equips (equip_type);

      -- Backfill equip_type from id for rows already in the DB so the
      -- /weapons split works without forcing a re-extraction. SQLite's
      -- '/' on integers is floor division, so id / 10000 mirrors the
      -- Math.floor(id / 10000) the extractor computes for new rows.
      -- cash can't be backfilled — it isn't derivable from id alone —
      -- and stays 0 until the next extraction pass overwrites it.
      UPDATE equips SET equip_type = CASE id / 10000
        WHEN 130 THEN 'one-handed-sword'
        WHEN 131 THEN 'one-handed-axe'
        WHEN 132 THEN 'one-handed-mace'
        WHEN 133 THEN 'dagger'
        WHEN 137 THEN 'wand'
        WHEN 138 THEN 'staff'
        WHEN 140 THEN 'two-handed-sword'
        WHEN 141 THEN 'two-handed-axe'
        WHEN 142 THEN 'two-handed-mace'
        WHEN 143 THEN 'spear'
        WHEN 144 THEN 'polearm'
        WHEN 145 THEN 'bow'
        WHEN 146 THEN 'crossbow'
        WHEN 147 THEN 'claw'
        WHEN 148 THEN 'knuckle'
        WHEN 149 THEN 'gun'
        ELSE NULL
      END;
    `,
  },
  {
    version: 11,
    name: 'backfill cash-weapon equip-type bucket',
    sql: `
      -- Bucket 170 (cash-shop weapon overlays like the Australia Cheer
      -- Towel) wasn't in the original equip_type lookup, so migration 10
      -- left these rows with equip_type NULL — which dropped them into
      -- /equips instead of /weapons where they belong. Backfill only the
      -- rows that haven't been classified yet so we don't clobber any
      -- types the extractor has since written.
      UPDATE equips
        SET equip_type = 'cash-weapon'
        WHERE equip_type IS NULL AND id / 10000 = 170;
    `,
  },
  {
    version: 12,
    name: 'normalize equip slot names to player-facing slugs',
    sql: `
      -- WZ stores slot keys like "longcoat" / "cap" / "petequip", but the
      -- game UI (and now our filter URLs, sidebar links, palette queries)
      -- use the in-tab names: "overall", "hat", "pet-equip". The extractor
      -- normalizes new rows via lib/equipTypes#normalizeEquipSlot; this
      -- migration rewrites rows imported under the old convention so
      -- existing DBs don't have to be re-extracted to match.
      --
      -- slot and category are written from the same value at extraction
      -- time, so they're rewritten in lockstep here.
      UPDATE equips SET slot = 'hat',       category = 'hat'       WHERE slot = 'cap';
      UPDATE equips SET slot = 'top',       category = 'top'       WHERE slot = 'coat';
      UPDATE equips SET slot = 'bottom',    category = 'bottom'    WHERE slot = 'pants';
      UPDATE equips SET slot = 'overall',   category = 'overall'   WHERE slot = 'longcoat';
      UPDATE equips SET slot = 'pet-equip', category = 'pet-equip' WHERE slot = 'petequip';
    `,
  },
  {
    version: 13,
    name: 'server profile selection',
    sql: `
      -- Records which immutable server profile the user selected. Profiles are
      -- defined in code / bundled JSON (lib/serverProfiles) and are never
      -- edited in place — this row just stores the chosen id. Lives in the
      -- game DB so it travels with a library backup.
      CREATE TABLE server_profile (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        profile_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO server_profile (id, profile_id, updated_at)
      VALUES (1, 'vanilla-v83', strftime('%s','now')*1000);
    `,
  },
  {
    version: 14,
    name: 'equip stat bonuses (str/dex/int/luk, hp/mp, speed/jump)',
    sql: `
      -- The WZ info block carries the full set of stat bonuses an equip
      -- grants, but extraction only stored the combat stats. Add the
      -- remaining bonuses (incSTR/DEX/INT/LUK, incMHP/MMP, incSpeed/Jump)
      -- so the detail page can show everything the equip actually gives.
      -- Nullable with no default: a NULL means "not yet re-extracted",
      -- distinct from an extracted 0/absent property. Re-running extraction
      -- backfills them.
      ALTER TABLE equips ADD COLUMN inc_str   INTEGER;
      ALTER TABLE equips ADD COLUMN inc_dex   INTEGER;
      ALTER TABLE equips ADD COLUMN inc_int   INTEGER;
      ALTER TABLE equips ADD COLUMN inc_luk   INTEGER;
      ALTER TABLE equips ADD COLUMN inc_hp    INTEGER;
      ALTER TABLE equips ADD COLUMN inc_mp    INTEGER;
      ALTER TABLE equips ADD COLUMN inc_speed INTEGER;
      ALTER TABLE equips ADD COLUMN inc_jump  INTEGER;
    `,
  },
  {
    version: 15,
    name: 'app metadata key-value store',
    sql: `
      -- Generic key-value store for app-level metadata about the library.
      -- Currently holds 'data_revision' (see db/dataVersion.ts): the revision
      -- of the extracted-data contract that produced the current rows. Lives in
      -- the game DB so it travels with a backup. We intentionally do NOT seed a
      -- data_revision here — a missing key reads as revision 0, which is below
      -- the minimum supported revision, so every pre-tracking database is
      -- correctly flagged as "must reinitialize" on first load of this build.
      CREATE TABLE app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 16,
    name: 'equip tradability and inventory metadata flags',
    sql: `
      -- Extra metadata keys carried on an equip's WZ info block, beyond the
      -- cosmetic 'cash' flag. The booleans default 0 (= flag absent in WZ);
      -- this ships as a breaking data-revision bump, so the destructive reset
      -- empties the table before this runs and re-extraction fills real values.
      ALTER TABLE equips ADD COLUMN trade_block       INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN equip_trade_block INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN account_sharable  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN only_one          INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN quest_item        INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN time_limited      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN expire_on_logout  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN pickup_block      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE equips ADD COLUMN not_sale          INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 17,
    name: 'item tradability and inventory metadata flags',
    sql: `
      -- The metadata keys items share with equips (migration 16), minus
      -- equip_trade_block (equip-only), plus two item-only flags: drop_block
      -- and trade_available. Booleans default 0 (= flag absent in WZ); this
      -- ships as a breaking data-revision bump, so the destructive reset
      -- empties the table before this runs and re-extraction fills real values.
      ALTER TABLE items ADD COLUMN cash              INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN trade_block       INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN account_sharable  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN only_one          INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN quest_item        INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN time_limited      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN expire_on_logout  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN pickup_block      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN not_sale          INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN drop_block        INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE items ADD COLUMN trade_available   INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 18,
    name: 'dataset source kind (wz vs img)',
    sql: `
      -- Which on-disk format the library was built from: a WZ archive or a
      -- folder of standalone .img files. Metadata only (no extraction-output
      -- change), so this is additive — existing rows default to 'wz'.
      ALTER TABLE datasets ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'wz';
    `,
  },
  {
    version: 19,
    name: 'quest chains (derived from quest prerequisites)',
    sql: `
      -- Quest chains are a derivation, not an extraction. The post-pass walks
      -- the directed graph of quest_requirements rows where kind='questPre'
      -- and groups quests into weakly-connected components (a chain is one
      -- WCC of size >= 2). Cycles in the source data are detected via
      -- Tarjan SCC and surfaced rather than papered over. See
      -- lib/questChains/graph.ts for the algorithm and
      -- db/queries/questChains.ts for the persistence.
      --
      -- Each quest belongs to at most one chain, so listing the chains a
      -- quest is in is a 1:0..1 lookup. The chain's id is the minimum
      -- quest_id among its roots (quests with no prerequisites), or — for
      -- fully-cyclic chains where no quest is enterable — the minimum
      -- quest_id overall. That makes the id stable across re-extractions
      -- as long as the representative quest persists.
      CREATE TABLE quest_chains (
        id                     INTEGER PRIMARY KEY,
        name                   TEXT NOT NULL,
        representative_root_id INTEGER NOT NULL,
        root_count             INTEGER NOT NULL,
        size                   INTEGER NOT NULL,
        max_depth              INTEGER NOT NULL,
        has_cycles             INTEGER NOT NULL,
        cycle_count            INTEGER NOT NULL,
        parent                 TEXT
      );
      CREATE INDEX quest_chains_parent_idx     ON quest_chains (parent);
      CREATE INDEX quest_chains_has_cycles_idx ON quest_chains (has_cycles);
      CREATE INDEX quest_chains_size_idx       ON quest_chains (size);

      -- One row per (chain, quest). depth is the BFS distance from the chain's
      -- condensation root SCC(s); for fully-cyclic chains it's 0 everywhere.
      -- scc_id is non-null iff the quest sits in a multi-quest SCC or a
      -- singleton SCC with a self-loop — i.e. it's involved in a cycle.
      -- Local to the chain (1..cycle_count), not global.
      CREATE TABLE quest_chain_members (
        chain_id INTEGER NOT NULL,
        quest_id INTEGER NOT NULL,
        depth    INTEGER NOT NULL,
        scc_id   INTEGER,
        is_root  INTEGER NOT NULL,
        PRIMARY KEY (chain_id, quest_id)
      );
      CREATE INDEX quest_chain_members_quest_idx      ON quest_chain_members (quest_id);
      CREATE INDEX quest_chain_members_chain_root_idx ON quest_chain_members (chain_id, is_root);

      -- Persisted edges so the graph viewer never has to re-join against
      -- quest_requirements. in_cycle = 1 iff both endpoints share a cyclic
      -- SCC (or it's a self-loop).
      CREATE TABLE quest_chain_edges (
        chain_id      INTEGER NOT NULL,
        from_quest_id INTEGER NOT NULL,
        to_quest_id   INTEGER NOT NULL,
        in_cycle      INTEGER NOT NULL,
        PRIMARY KEY (chain_id, from_quest_id, to_quest_id)
      );
    `,
  },
  {
    version: 20,
    name: 'quest chain critical-path flag',
    sql: `
      -- Marks quests that sit on a path from any starting quest to the
      -- chain's deepest leaf — i.e. the "must do" subset needed to reach
      -- the final quest. Computed at chain-derivation time alongside the
      -- stage/SCC fields (see lib/questChains/graph.ts). The "Critical
      -- path only" toggle on the detail page filters members and edges
      -- to is_critical = 1; the default view leaves optional quests in
      -- place with reduced emphasis.
      --
      -- DEFAULT 0 means rows surviving from before this migration look
      -- like "all optional" until a re-derivation runs — paired with the
      -- CURRENT_DATA_REVISION bump that nudges the user to re-run setup.
      ALTER TABLE quest_chain_members
        ADD COLUMN is_critical INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX quest_chain_members_chain_critical_idx
        ON quest_chain_members (chain_id, is_critical);
    `,
  },
  {
    version: 21,
    name: 'quest chain external prereq edges',
    sql: `
      -- Cross-chain prereq edges. Populated by the chain-derivation pass
      -- alongside quest_chain_edges (see lib/questChains/graph.ts) once
      -- chains became parent-bounded — any prereq edge whose endpoints
      -- sit in different chains (or one endpoint is unaffiliated) lands
      -- here so the detail page can render an "Unlocked by" / "Unlocks"
      -- section without merging the two storylines into one chain.
      --
      -- One row per (chain, direction, edge): the same source-graph edge
      -- is recorded twice when both endpoints are in chains, once from
      -- each chain's perspective, so a SELECT WHERE chain_id = ? returns
      -- everything the detail page needs in one query.
      --
      -- direction:
      --   'in'  — external quest is a prereq of an internal quest
      --   'out' — internal quest is a prereq of an external quest
      -- external_chain_id is nullable for cases where the external quest
      -- isn't itself in a chain (size-1 WCC or no prereq edges at all).
      CREATE TABLE quest_chain_external_edges (
        chain_id           INTEGER NOT NULL,
        direction          TEXT    NOT NULL,
        internal_quest_id  INTEGER NOT NULL,
        external_quest_id  INTEGER NOT NULL,
        external_chain_id  INTEGER,
        PRIMARY KEY (chain_id, direction, internal_quest_id, external_quest_id)
      );
      CREATE INDEX quest_chain_external_edges_external_idx
        ON quest_chain_external_edges (external_chain_id);
    `,
  },
  {
    version: 22,
    name: 'quest repeat interval',
    sql: `
      -- NULL = not repeatable. Non-null = cooldown in seconds.
      ALTER TABLE quests ADD COLUMN repeat_wait INTEGER;
    `,
  },
  {
    version: 23,
    name: 'quest reward variants (prop / job / gender / period)',
    sql: `
      -- The WZ Act.img reward node carries per-entry metadata we previously
      -- collapsed into (kind, target_id, amount):
      --   prop    weighted-random pool entry (absent = guaranteed)
      --   job     job-restriction bitfield, same convention as equips.reqJob
      --   gender  0 = male, 1 = female, 2 = any (absent = any)
      --   period  expiration in minutes (absent = permanent)
      -- The kind set also widens from {item,exp,meso} to include sp, fame,
      -- buff (buffItemID), and skill so non-item rewards stop disappearing.
      --
      -- The old PK (quest_id, kind, target_id) lost ordering and couldn't
      -- distinguish job-locked variants that share a target_id, so the
      -- table is rebuilt with an explicit child-index column. For non-item
      -- kinds (exp/meso/sp/fame) there's only one row per kind and idx=0.
      --
      -- Ships as a breaking data-revision bump; the destructive reset
      -- empties the table before this runs, so the schema is written clean.
      DROP TABLE quest_rewards;
      CREATE TABLE quest_rewards (
        quest_id  INTEGER NOT NULL,
        kind      TEXT NOT NULL,
        idx       INTEGER NOT NULL,
        target_id INTEGER,
        amount    INTEGER,
        prop      INTEGER,
        job       INTEGER,
        gender    INTEGER,
        period    INTEGER,
        PRIMARY KEY (quest_id, kind, idx)
      );
      CREATE INDEX quest_rewards_target_idx ON quest_rewards (kind, target_id);
    `,
  },
  {
    version: 24,
    name: 'skills',
    sql: `
      -- A skill row mirrors what \`Skill.wz/<jobId>.img/skill/<skillId>\`
      -- carries on top of its identity strings from
      -- \`String.wz/Skill.img/<skillId>\`. The mutable per-level fields
      -- (mp cost, damage, buffs) live in \`skill_levels\` keyed by
      -- (skill_id, level) — see migration notes below.
      --
      -- \`name\` is nullable because a job's skill table sometimes lists
      -- a skill whose String.wz entry hasn't been localized yet; we still
      -- want to surface the row with its numeric ID rather than drop it.
      -- \`element\` and \`required_weapon\` are stored verbatim so the
      -- decoder can evolve without a schema change.
      CREATE TABLE skills (
        id              INTEGER PRIMARY KEY,
        job_id          INTEGER NOT NULL,
        name            TEXT,
        description     TEXT,
        tooltip         TEXT,
        max_level       INTEGER,
        master_level    INTEGER,
        hidden          INTEGER NOT NULL DEFAULT 0,
        element         TEXT,
        required_weapon TEXT,
        icon_path       TEXT,
        icon_data       BLOB,
        source_path     TEXT NOT NULL
      );
      CREATE INDEX skills_job_id_idx ON skills (job_id);
      CREATE INDEX skills_name_idx ON skills (name);

      -- One row per (skill, level). Stat columns are nullable because
      -- different skill archetypes touch different fields — an attack
      -- skill carries damage_percent while a buff skill carries pad/mad.
      -- \`raw_json\` preserves any WZ keys we don't yet promote to
      -- columns, so the detail page can grow a new field by reading
      -- the JSON rather than triggering another migration.
      CREATE TABLE skill_levels (
        skill_id          INTEGER NOT NULL,
        level             INTEGER NOT NULL,
        mp_cost           INTEGER,
        hp_cost           INTEGER,
        damage_percent    INTEGER,
        hits              INTEGER,
        targets           INTEGER,
        duration_seconds  INTEGER,
        cooldown_seconds  INTEGER,
        chance_percent    INTEGER,
        x                 INTEGER,
        y                 INTEGER,
        z                 INTEGER,
        pad               INTEGER,
        mad               INTEGER,
        pdd               INTEGER,
        mdd               INTEGER,
        acc               INTEGER,
        eva               INTEGER,
        speed             INTEGER,
        jump              INTEGER,
        hp                INTEGER,
        mp                INTEGER,
        hp_percent        INTEGER,
        mp_percent        INTEGER,
        raw_json          TEXT,
        PRIMARY KEY (skill_id, level)
      );

      -- A skill's prerequisite list: each row says skill \`skill_id\`
      -- needs \`required_skill_id\` at level >= \`required_level\`.
      -- Reverse-lookup index powers the "Required by" section of the
      -- detail page (skills that need this one).
      CREATE TABLE skill_prerequisites (
        skill_id          INTEGER NOT NULL,
        required_skill_id INTEGER NOT NULL,
        required_level    INTEGER NOT NULL,
        PRIMARY KEY (skill_id, required_skill_id)
      );
      CREATE INDEX skill_prereqs_required_idx ON skill_prerequisites (required_skill_id);
    `,
  },
  {
    version: 25,
    name: 'jobs reference table',
    sql: `
      -- Small reference table populated from \`String.wz/Job.img\`. Holds
      -- the canonical "id → name" mapping for the ~50 jobs (Beginner +
      -- 5 base classes × 4 advancement tiers) so skill rows can render
      -- a real job name instead of the raw integer.
      --
      -- \`base_job_id\` is derived at extraction time so listings can
      -- group by branch without re-running the math.
      CREATE TABLE jobs (
        id          INTEGER PRIMARY KEY,
        name        TEXT NOT NULL,
        base_job_id INTEGER NOT NULL
      );
      CREATE INDEX jobs_base_job_idx ON jobs (base_job_id);
    `,
  },
  {
    version: 26,
    name: 'skill level static description',
    sql: `
      -- Older WZ dumps don't carry a templated \`h\` on the parent skill —
      -- they put a literal description on each level as \`h1\`, \`h2\`,
      -- \`h3\`, ..., \`h<level>\`. Store the resolved string here so the
      -- per-level table can show it verbatim without inventing template
      -- placeholders the data doesn't have.
      ALTER TABLE skill_levels ADD COLUMN description TEXT;
    `,
  },
  {
    version: 27,
    name: 'denormalized quest scalar rewards',
    sql: `
      -- Scalar completion rewards copied onto the quest row so the index
      -- page can filter / sort without a join over quest_rewards. Additive
      -- data-revision bump: NULL means "this quest hasn't been re-extracted
      -- yet" or "no reward of this kind"; the extractor writes 0 when the
      -- WZ entry is absent or zero.
      ALTER TABLE quests ADD COLUMN reward_exp   INTEGER;
      ALTER TABLE quests ADD COLUMN reward_meso  INTEGER;
      ALTER TABLE quests ADD COLUMN reward_fame  INTEGER;

      CREATE INDEX IF NOT EXISTS quests_reward_exp_idx  ON quests (reward_exp);
      CREATE INDEX IF NOT EXISTS quests_reward_meso_idx ON quests (reward_meso);
      CREATE INDEX IF NOT EXISTS quests_reward_fame_idx ON quests (reward_fame);
    `,
  },
];
