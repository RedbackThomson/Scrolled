# Adding a synced entity

How to make a new piece of user data sync across devices. Read
[`sync_design.md`](sync_design.md) first for the model; this is the practical
checklist for wiring a new entity through it.

**Scope reminder.** Only the **user DB** (`/user.sqlite3`) syncs — collections,
groups, members, pinned searches, settings, recents. The game DB never syncs
(it's a derived cache). So "a new synced entity" always means a new user-DB
table or a new `user_settings` key. If your data belongs in the game DB, it
doesn't sync and none of this applies.

Two shortcuts before you build a whole entity:

- **A new preference** → don't add a table. Store it as a row in `user_settings`
  (`key`/`value` JSON) via `setUserSetting`. It already syncs as the
  `user_setting` entity. Decide per the litmus test in `sync_design.md` §1
  whether it should sync at all (sync what a user would hate to reconfigure on
  another device; keep device/screen-driven state in `localStorage`).
- **A new column on an entity that already syncs** → just add it in a forward-only
  user-DB migration (with a `DEFAULT` — see below) and include it in that
  entity's `upsertColumns`/`toWirePayload` mapping. No new entity needed.

A genuinely new **table** that should sync needs every step below. Miss one and
the symptom is usually silent: changes don't leave the device, or a remote batch
throws inside `applyRemoteChanges` and the engine retries forever.

---

## The contract every synced row carries

Each synced table has these columns (the cross-device contract, `sync_design.md`
§6.1):

```sql
uuid          TEXT    NOT NULL DEFAULT '',   -- stable cross-device identity (the integer PK stays local)
revision      INTEGER NOT NULL DEFAULT 0,    -- server-assigned; bumped on every accepted write
updated_at    INTEGER NOT NULL DEFAULT 0,    -- wall-clock HINT only (merge tiebreak, never the arbiter)
deleted_at    INTEGER,                       -- set transiently on a delete capture; rows hard-delete
origin_device TEXT    NOT NULL DEFAULT '',   -- device that authored the current revision
```

The `uuid` is what the wire and conflict resolution use; the existing
`INTEGER PRIMARY KEY` stays the local key foreign keys reference, so nothing
relational is rewired. Children reference their parent by the parent's **uuid**
on the wire, even though locally they join on the integer FK.

---

## Step 1 — Migration (`apps/web/src/db/user/migrations.ts`)

Append a new forward-only entry (never edit or reorder a shipped one). Create the
table with the five contract columns, and a **non-unique** index on `uuid` (a
bulk insert writes `uuid=''` before the mutation layer stamps each row, which a
unique index would reject). If you're adding columns to an existing table,
backfill `uuid = lower(hex(randomblob(16)))` and `revision = 1` for existing
rows.

Every `NOT NULL` column needs a `DEFAULT` — the user DB can already hold rows
when the migration runs, and SQLite bricks `open()` on a bare `NOT NULL` add.
See DEVELOPMENT.md → "Schema and data versioning". (The user DB has its own
version namespace, independent of the game DB, and no data-revision concept —
the migration is all you need.)

If the table has a user-editable natural key (a `UNIQUE` name, a composite PK),
note it — Step 7 and Step 8 depend on it.

## Step 2 — Declare the entity (`packages/sync-core/src/types.ts`)

Add the entity name to the `SyncEntity` union **and** the `SYNC_ENTITIES` array
(the zod enum is derived from it). This is a **wire-contract change**: an older
client validating a pull that contains the new entity will reject it. If old
clients must keep working against a server that now emits the new entity, bump
`PROTOCOL_VERSION` (and the `sync_protocol` row) and raise `min_client_revision`.
See `sync_design.md` §15.

## Step 3 — Map the entity in the worker (`apps/web/src/db/user/queries/sync.ts`)

This file is where most wiring lives. For the new entity, add a case/entry to
each of:

1. **`ENTITY_TABLE`** — entity → table name.
2. **`ENTITY_QUERY_KEY`** — entity → the TanStack query-key root a remote apply
   should invalidate (so the same views that react to local mutations refresh).
3. **`SYNCED_TABLES`** — add the table (swept by `markOutboxSynced`, GC, reset,
   and re-bootstrap).
4. **`ADOPTION_ORDER`** — insert at the right spot: **parents before children**,
   so adoption and a fresh pull apply a parent before a row that references it.
5. **`matchKey`** — how to identify the record for conflict matching: a
   user-editable-key entity keys on its random `uuid` (the default); an entity
   with a stable natural key (like a setting's `key`, a recent's `kind`+`ref`)
   keys on that, so two devices that minted the row independently still
   converge.
6. **`liveMatch`** — the `table` + `WHERE` + params that locate the live local
   row for this entity.
7. **`upsertColumns`** — the column→value map applied on a remote upsert. Stamp
   the sync columns, copy the data columns off the wire payload, and resolve any
   parent **uuid → local integer FK** via `resolveByUuid` (return `null` if the
   parent isn't present yet — a later batch resolves it).
8. **`toWirePayload`** — the inverse: drop local-only columns (e.g. the
   integer `id`, any game-derived display label like `recents.name` that must
   never sync) and rewrite local FKs to the parent's **uuid**.
9. **`dedupeUniqueName`** — only if the table has a `UNIQUE` name. Add a case so a
   same-name/different-uuid row from another device is auto-suffixed instead of
   throwing `SQLITE_CONSTRAINT_UNIQUE` (which would wedge the engine). Scope it
   by the parent column for a composite unique (as groups do on
   `collection_id`).

## Step 4 — Funnel mutations through the outbox (`apps/web/src/db/user/queries/…`)

Every mutation of the new table must, **inside its existing transaction**, call
the chokepoint in `queries/sync.ts`:

- `recordUpsert(db, entity, where, params)` after an insert/update — stamps the
  sync columns and enqueues an `upsert` snapshot.
- `recordDelete(db, entity, where, params)` **before** a hard delete — captures a
  `delete` outbox entry while the row still exists. (Cascade deletes bypass this;
  capture tombstones for the whole subtree first, as `deleteCollection` does.)
- `recordNewRows(db, entity)` after a bulk insert that wrote rows with `uuid=''`
  (the import path) — sweeps and stamps them.

This atomicity (data write + outbox row commit together) is the core invariant:
no mutation can escape the outbox. The worker rings the outbox doorbell
automatically from `appendOutbox`.

## Step 5 — Conflict override, only if needed (`packages/sync-core/src/conflict.ts`)

The default is server-ordered last-write-wins (`updated_at` hint,
`origin_device` tiebreak). Add a per-entity override only if the entity needs
different merge semantics — e.g. recents take the max `viewed_at`, a collection
delete is delete-wins. Most entities need nothing here.

## Step 6 — Drain lane, only if high-churn (`packages/sync-core/src/engine.ts`)

`FAST_LANE_ENTITIES` drains ~1s after a mutation. Leave a new entity in the fast
lane unless it's write-heavy like recents (which drain on the lazy 10–15s timer
to avoid dominating traffic) — in that case **omit** it from `FAST_LANE_ENTITIES`
so it takes the lazy lane.

## Step 7 — Server side (usually nothing)

`sync_records` stores `entity` as opaque text and `payload` as `jsonb`, so the
push/pull RPCs handle a new entity with no migration. You only touch
`supabase/` if the new entity needs server-specific handling (it shouldn't).

## Step 8 — Tests

Mirror the existing coverage:

- `queries/sync.test.ts` — the outbox accumulates an entry on mutation, with the
  right `op`/`base_revision`.
- `queries/applyRemoteChanges.test.ts` — `drainOutbox` projects the wire payload
  (local-only columns dropped, FKs → parent uuid); `applyRemoteChanges` inserts,
  updates, and hard-deletes; an end-to-end converge through the mock server.
- `queries/syncBootstrap.test.ts` — adoption enqueues the new entity in the right
  parents-before-children order, and a same-name collision converges without a
  throw (if the entity has a unique name).

---

## Quick checklist

- [ ] Migration: table + 5 contract columns + non-unique `uuid` index (forward-only)
- [ ] `SyncEntity` union + `SYNC_ENTITIES` (bump `PROTOCOL_VERSION` if it breaks old clients)
- [ ] `sync.ts`: `ENTITY_TABLE`, `ENTITY_QUERY_KEY`, `SYNCED_TABLES`, `ADOPTION_ORDER`,
      `matchKey`, `liveMatch`, `upsertColumns`, `toWirePayload`, `dedupeUniqueName` (if unique)
- [ ] Mutations call `recordUpsert` / `recordDelete` / `recordNewRows` in-transaction
- [ ] Conflict override (only if non-default semantics)
- [ ] Drain lane (only if high-churn)
- [ ] Tests for outbox, wire projection, apply, convergence
