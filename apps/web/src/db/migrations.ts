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
];
