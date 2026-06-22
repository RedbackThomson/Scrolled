// Versioned SQL migrations for the user-data SQLite file.
//
// Same runner semantics as `db/migrations.ts`: each entry runs in one
// transaction, never edit or reorder existing entries, append new ones at
// the end. The user DB is independent of the game DB — schema versions
// don't share a numbering namespace.

import type { Migration } from '@scrolled/game-db/db/migrations';

/**
 * The deterministic, well-known `uuid` the seeded "Favourites" collection is
 * rewritten to by migration v7. Every install seeds Favourites (v1) and the v6
 * backfill gave each a *random* uuid, so two devices' Favourites were distinct
 * records that collided on the UNIQUE `name` when synced. Pinning the seed to
 * one shared uuid makes it a single logical record that converges by LWW
 * instead (docs/sync_design.md §7). It is a sentinel hex string, not a random
 * id, so it can never collide with a `randomblob`-minted uuid.
 */
export const SEEDED_FAVOURITES_UUID = '5eed0000000000000000000000fa0001';

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
  {
    version: 6,
    name: 'sync foundations',
    // Phase 1 of the sync system (docs/sync_design.md): the local-only
    // foundations. Every synced table gains the cross-device contract columns,
    // the synced key/value (`user_settings`) and `recents` tables replace their
    // localStorage / idb-keyval homes, and the bookkeeping tables (`sync_outbox`,
    // `sync_cursor`, `sync_state`) accumulate changes that a later phase drains
    // to a backend. No network touches any of this yet.
    //
    // `uuid` is the stable cross-device identity used on the wire; the integer
    // PK stays the local-only key foreign keys already reference, so nothing
    // relational is rewired. Existing rows are backfilled a random uuid and
    // stamped `revision = 1`. The index on `uuid` is intentionally NOT unique:
    // a bulk insert (e.g. import) writes many rows with the default `''` before
    // the mutation layer stamps each one, which a unique index would reject.
    sql: `
      ALTER TABLE collections ADD COLUMN uuid          TEXT    NOT NULL DEFAULT '';
      ALTER TABLE collections ADD COLUMN revision      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE collections ADD COLUMN deleted_at    INTEGER;
      ALTER TABLE collections ADD COLUMN origin_device TEXT    NOT NULL DEFAULT '';
      UPDATE collections SET uuid = lower(hex(randomblob(16))), revision = 1 WHERE uuid = '';
      CREATE INDEX collections_uuid_idx ON collections (uuid);

      ALTER TABLE collection_members ADD COLUMN uuid          TEXT    NOT NULL DEFAULT '';
      ALTER TABLE collection_members ADD COLUMN revision      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE collection_members ADD COLUMN updated_at    INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE collection_members ADD COLUMN deleted_at    INTEGER;
      ALTER TABLE collection_members ADD COLUMN origin_device TEXT    NOT NULL DEFAULT '';
      UPDATE collection_members
        SET uuid = lower(hex(randomblob(16))), revision = 1, updated_at = added_at
        WHERE uuid = '';
      CREATE INDEX collection_members_uuid_idx ON collection_members (uuid);

      ALTER TABLE collection_groups ADD COLUMN uuid          TEXT    NOT NULL DEFAULT '';
      ALTER TABLE collection_groups ADD COLUMN revision      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE collection_groups ADD COLUMN deleted_at    INTEGER;
      ALTER TABLE collection_groups ADD COLUMN origin_device TEXT    NOT NULL DEFAULT '';
      UPDATE collection_groups SET uuid = lower(hex(randomblob(16))), revision = 1 WHERE uuid = '';
      CREATE INDEX collection_groups_uuid_idx ON collection_groups (uuid);

      ALTER TABLE pinned_searches ADD COLUMN uuid          TEXT    NOT NULL DEFAULT '';
      ALTER TABLE pinned_searches ADD COLUMN revision      INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE pinned_searches ADD COLUMN deleted_at    INTEGER;
      ALTER TABLE pinned_searches ADD COLUMN origin_device TEXT    NOT NULL DEFAULT '';
      UPDATE pinned_searches SET uuid = lower(hex(randomblob(16))), revision = 1 WHERE uuid = '';
      CREATE INDEX pinned_searches_uuid_idx ON pinned_searches (uuid);

      CREATE TABLE user_settings (
        key           TEXT PRIMARY KEY,
        value         TEXT    NOT NULL,
        uuid          TEXT    NOT NULL DEFAULT '',
        revision      INTEGER NOT NULL DEFAULT 0,
        updated_at    INTEGER NOT NULL DEFAULT 0,
        deleted_at    INTEGER,
        origin_device TEXT    NOT NULL DEFAULT ''
      );

      CREATE TABLE recents (
        kind          TEXT    NOT NULL CHECK (kind IN ('entity','query')),
        ref           TEXT    NOT NULL,
        -- Local display label for entity rows (resolved from the game DB at
        -- track time). Not part of the sync contract — game-derived names never
        -- sync; a later phase projects the wire payload to omit it.
        name          TEXT,
        viewed_at     INTEGER NOT NULL,
        uuid          TEXT    NOT NULL DEFAULT '',
        revision      INTEGER NOT NULL DEFAULT 0,
        updated_at    INTEGER NOT NULL DEFAULT 0,
        deleted_at    INTEGER,
        origin_device TEXT    NOT NULL DEFAULT '',
        PRIMARY KEY (kind, ref)
      );

      CREATE TABLE sync_outbox (
        seq           INTEGER PRIMARY KEY AUTOINCREMENT,
        entity        TEXT    NOT NULL,
        uuid          TEXT    NOT NULL,
        op            TEXT    NOT NULL CHECK (op IN ('upsert','delete')),
        payload       TEXT    NOT NULL,
        base_revision INTEGER NOT NULL,
        created_at    INTEGER NOT NULL,
        idempotency   TEXT    NOT NULL
      );

      CREATE TABLE sync_cursor (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        server_seq INTEGER NOT NULL DEFAULT 0,
        device_id  TEXT    NOT NULL,
        account_id TEXT
      );

      INSERT INTO sync_cursor (id, server_seq, device_id, account_id)
      VALUES (1, 0, lower(hex(randomblob(16))), NULL);

      CREATE TABLE sync_state (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Relocate the synced UI prefs (home layout, etc.) into user_settings,
      -- stamping each with a fresh sync identity, then retire ui_prefs.
      INSERT INTO user_settings (key, value, uuid, revision, updated_at, origin_device)
        SELECT key, value, lower(hex(randomblob(16))), 1, updated_at, '' FROM ui_prefs;
      DROP TABLE ui_prefs;
    `,
  },
  {
    version: 7,
    name: 'deterministic favourites uuid',
    // Pin the seeded "Favourites" collection to a well-known cross-device uuid
    // so every device's seed is the SAME logical record and converges on
    // sign-in, rather than each device's random uuid colliding on the UNIQUE
    // `name` when two devices sync (docs/sync_design.md §7; the remote-apply
    // path now auto-suffixes genuine user-created same-name clashes too).
    //
    // Only the *untouched* seed is rewritten: still named 'Favourites' with the
    // 'star' icon, never locally edited (revision = 1 from the v6 backfill), not
    // tombstoned — and only while this install has not yet joined an account
    // (`account_id` IS NULL). A device that already adopted/pushed its
    // Favourites under the random uuid keeps it, so the rewrite never orphans a
    // record the server already holds. Written as an UPDATE so it is a harmless
    // no-op on a DB whose seed was renamed, deleted, or already adopted.
    sql: `
      UPDATE collections
         SET uuid = '${SEEDED_FAVOURITES_UUID}'
       WHERE name = 'Favourites'
         AND icon = 'star'
         AND revision = 1
         AND deleted_at IS NULL
         AND uuid <> '${SEEDED_FAVOURITES_UUID}'
         AND (SELECT account_id FROM sync_cursor WHERE id = 1) IS NULL;
    `,
  },
];
