// Versioned SQL migrations for the user-data SQLite file.
//
// Same runner semantics as `db/migrations.ts`: each entry runs in one
// transaction, never edit or reorder existing entries, append new ones at
// the end. The user DB is independent of the game DB — schema versions
// don't share a numbering namespace.

import type { Migration } from '@scrolled/game-db/db/migrations';

export const USER_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'collections v1',
    sql: `
      CREATE TABLE collections (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL UNIQUE,
        description TEXT,
        color       TEXT,
        icon        TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE TABLE collection_members (
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        entity_type   TEXT    NOT NULL CHECK (entity_type IN ('item','equip','mob','npc','map','quest')),
        entity_id     INTEGER NOT NULL,
        note          TEXT,
        quantity      INTEGER,
        done          INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0,1)),
        added_at      INTEGER NOT NULL,
        PRIMARY KEY (collection_id, entity_type, entity_id)
      );

      CREATE INDEX collection_members_entity_idx
        ON collection_members (entity_type, entity_id);

      CREATE INDEX collection_members_collection_idx
        ON collection_members (collection_id);

      -- Seed the default "Favourites" collection. It's a normal row — the
      -- user can rename or delete it like any other.
      INSERT INTO collections (name, icon, created_at, updated_at)
      VALUES ('Favourites', 'star', strftime('%s','now')*1000, strftime('%s','now')*1000);
    `,
  },
  {
    version: 2,
    name: 'pinned searches v1',
    sql: `
      CREATE TABLE pinned_searches (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL UNIQUE,
        entity      TEXT    NOT NULL CHECK (entity IN ('item','equip','mob','npc','map','quest')),
        params_json TEXT    NOT NULL DEFAULT '{}',
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );
    `,
  },
  {
    version: 3,
    name: 'collections pinned v1',
    // Pin metadata for the home page. `pinned_position` orders the pinned
    // grid (lower = earlier); NULL means unpinned. `pinned` is the boolean
    // we sort + filter on so the index is small and the predicate is cheap.
    sql: `
      ALTER TABLE collections
        ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0,1));
      ALTER TABLE collections
        ADD COLUMN pinned_position INTEGER;

      CREATE INDEX collections_pinned_idx
        ON collections (pinned, pinned_position);
    `,
  },
  {
    version: 4,
    name: 'ui prefs v1',
    // Generic key-value table for UI chrome preferences that belong to
    // the user (so they survive WZ re-imports and ride backup/restore).
    // First consumer is the home-page layout (`home.layout`); other
    // future prefs go here too rather than spawning one table each.
    // Values are JSON-encoded strings — keeps the schema flat and lets
    // each consumer own its own validation via zod.
    sql: `
      CREATE TABLE ui_prefs (
        key        TEXT    PRIMARY KEY,
        value      TEXT    NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 5,
    name: 'collection groups v1',
    // Named groups inside a collection, plus an explicit per-member
    // `position` so the user can reorder. The default group is implicit:
    // a NULL `group_id` means "ungrouped". The four display-option
    // columns on `collections` mirror the Linear-backlog "display
    // options" popover used on table pages — primary grouping axis,
    // secondary (sub)grouping axis, sort key, and sort direction. The
    // trailing UPDATE seeds positions for pre-existing members from
    // `added_at` so today's insertion order is preserved.
    sql: `
      CREATE TABLE collection_groups (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        name          TEXT    NOT NULL,
        position      INTEGER NOT NULL,
        created_at    INTEGER NOT NULL,
        updated_at    INTEGER NOT NULL,
        UNIQUE (collection_id, name)
      );

      CREATE INDEX collection_groups_collection_idx
        ON collection_groups (collection_id, position);

      ALTER TABLE collection_members
        ADD COLUMN group_id INTEGER REFERENCES collection_groups(id) ON DELETE SET NULL;
      ALTER TABLE collection_members
        ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

      CREATE INDEX collection_members_group_idx
        ON collection_members (collection_id, group_id, position);

      ALTER TABLE collections
        ADD COLUMN grouping TEXT NOT NULL DEFAULT 'group'
          CHECK (grouping IN ('none','group','type'));
      ALTER TABLE collections
        ADD COLUMN subgrouping TEXT NOT NULL DEFAULT 'type'
          CHECK (subgrouping IN ('none','group','type'));
      ALTER TABLE collections
        ADD COLUMN sort_key TEXT NOT NULL DEFAULT 'manual'
          CHECK (sort_key IN ('manual','name','added','done','quantity'));
      ALTER TABLE collections
        ADD COLUMN sort_dir TEXT NOT NULL DEFAULT 'asc'
          CHECK (sort_dir IN ('asc','desc'));

      UPDATE collection_members
      SET position = (
        SELECT COUNT(*) - 1
        FROM collection_members m2
        WHERE m2.collection_id = collection_members.collection_id
          AND (
            m2.added_at < collection_members.added_at
            OR (m2.added_at = collection_members.added_at AND m2.rowid <= collection_members.rowid)
          )
      );
    `,
  },
];
