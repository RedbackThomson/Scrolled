// Versioned SQL migrations for the user-data SQLite file.
//
// Same runner semantics as `db/migrations.ts`: each entry runs in one
// transaction, never edit or reorder existing entries, append new ones at
// the end. The user DB is independent of the game DB — schema versions
// don't share a numbering namespace.

import type { Migration } from '../migrations';

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
];
