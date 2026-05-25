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
];
