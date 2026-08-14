# Adding a synced entity

How to make a new piece of user data sync across devices. Read
[`sync_design.md`](sync_design.md) first for the model; this is the practical
checklist for wiring a new entity through it.

**Scope reminder.** Only the **user DB** (`/user.sqlite3`) syncs. The game DB
never syncs — it's a derived cache. So "a new synced entity" always means a new
user-DB table or a new `user_settings` key.

Two shortcuts before you build a whole entity:

- **A new preference** → don't add a table. Store it as a row in `user_settings`
  via `setUserSetting`; it already syncs. Decide per the litmus test in
  `sync_design.md` §1 whether it should sync at all.
- **A new column on an entity that already syncs** → add it in a forward-only
  user-DB migration (with a `DEFAULT` — see below) and include it in that
  entity's `localColumns`/`toRemoteRow` mapping.

A genuinely new **table** needs every step below. Miss one and the symptom is
usually silent: changes don't leave the device.

---

## Decide the identity first

Everything else follows from it. A record's identity is the same set of columns
locally and remotely, declared once in `ENTITY_KEY_COLUMNS`:

- **A stable natural key** (a setting's name, a `(kind, ref)` pair, a
  `(parent, type, id)` triple) — use it directly. Two devices that create the row
  independently then converge on one row with no further work. Prefer this.
- **No stable natural key** (the user can rename it) — mint a `key` client-side
  and give the user-visible name a partial unique index. A collision becomes a
  merge, handled by the rekey path.

---

## The contract every synced row carries

```sql
uuid          TEXT    NOT NULL DEFAULT '',   -- the key the backend knows it by; unused for naturally-keyed entities
remote_seq    INTEGER NOT NULL DEFAULT 0,    -- backend seq of the version held; drives staleness
updated_at    INTEGER NOT NULL DEFAULT 0,    -- wall-clock hint, never an integrity comparator
deleted_at    INTEGER,                       -- set on a delete capture; rows hard-delete locally
origin_device TEXT    NOT NULL DEFAULT '',
```

The existing `INTEGER PRIMARY KEY` stays the local key foreign keys reference, so
nothing relational is rewired. Children reference their parent by the parent's
key remotely, even though locally they join on the integer FK.

---

## Step 1 — Local migration (`apps/web/src/db/user/migrations.ts`)

Append a forward-only entry; never edit or reorder a shipped one. Create the
table with the contract columns and a **non-unique** index on `uuid` — a bulk
insert writes `uuid=''` before the mutation layer stamps each row.

Every `NOT NULL` column needs a `DEFAULT`: the user DB can already hold rows when
the migration runs, and SQLite bricks `open()` on a bare `NOT NULL` add. See
DEVELOPMENT.md → "Schema and data versioning". The user DB has its own version
namespace and no data-revision concept.

## Step 2 — Backend table (`supabase/migrations/`)

Add a table mirroring the local one, with `account_id`, `origin_device`,
`deleted_at`, `seq`, and `server_time`. Give it:

- a primary key matching `ENTITY_KEY_COLUMNS`,
- a foreign key to its parent, if it has one,
- a partial unique index on any user-visible name, `where deleted_at is null`,
- the `_stamp` and `_poke` triggers,
- the `for all` RLS policy and the `authenticated` grants.

Copy the shape from an existing table in
`20260814000000_sync_relational.sql`. The backend's constraints must match the
local ones, or a pulled row can violate a local constraint.

## Step 3 — Declare the entity (`packages/sync-core/src/types.ts`)

Add the name to the `SyncEntity` union and to `SYNC_ENTITIES` — **parents before
children**, since push and apply both use that order. Then add entries to
`ENTITY_TABLE`, `ENTITY_KEY_COLUMNS`, and `ENTITY_UNIQUE_NAME` if it has one.

This is a wire-contract change: an older client validating a pull containing the
new entity will reject it. If old clients must keep working, bump
`PROTOCOL_VERSION` and the `sync_protocol` row.

## Step 4 — Map it locally (`apps/web/src/db/user/queries/sync.ts`)

Add a case to each of:

1. **`ENTITY_TABLE`** — entity → local table name.
2. **`ENTITY_QUERY_KEY`** — the TanStack query-key root a remote apply should
   invalidate, so the views that react to local mutations also refresh.
3. **`liveMatchByRow`** — locate the local row from a backend row, resolving any
   parent key to its local integer id. Return `null` if the parent is absent.
4. **`liveMatchByKey`** — the same, from a coalesced record key.
5. **`localColumns`** — backend row → local columns. Translate booleans with
   `bit()`; SQLite has no boolean type.
6. **`toRemoteRow`** — the inverse. Drop local-only columns (the integer `id`,
   any game-derived display label) and rewrite local FKs to the parent's key.

## Step 5 — Funnel mutations through the outbox

Every mutation of the new table must call the chokepoint **inside its existing
transaction**:

- `recordUpsert(db, entity, where, params)` after an insert or update.
- `recordDelete(db, entity, where, params)` **before** a hard delete, while the
  row still exists. Cascade deletes bypass this — capture the whole subtree
  first, as `deleteCollection` does.
- `recordNewRows(db, entity)` after a bulk insert that wrote `uuid=''`.

Data write and outbox row committing together is the core invariant: no mutation
can escape the outbox. The doorbell rings automatically from `appendOutbox`.

## Step 6 — Drain lane, only if high-churn

`FAST_LANE_ENTITIES` in the engine drains ~1s after a mutation. Leave a new
entity there unless it is write-heavy like recents, which take the slower lane so
they don't dominate traffic.

## Step 7 — Tests

- `queries/sync.test.ts` — a mutation appends the right outbox entry.
- `queries/applyRemoteRows.test.ts` — apply inserts, updates, skips stale and
  pending rows, and hard-deletes on a tombstone.
- `queries/syncBootstrap.test.ts` — two devices converge, including a same-name
  collision if the entity has a unique name.

---

## Quick checklist

- [ ] Identity decided: natural key, or minted key plus a unique name
- [ ] Local migration: table + contract columns + non-unique `uuid` index
- [ ] Backend migration: table, PK, FK, partial unique index, triggers, RLS, grants
- [ ] `SyncEntity`, `SYNC_ENTITIES` (parent-first), `ENTITY_TABLE`,
      `ENTITY_KEY_COLUMNS`, `ENTITY_UNIQUE_NAME`
- [ ] `sync.ts`: `ENTITY_TABLE`, `ENTITY_QUERY_KEY`, `liveMatchByRow`,
      `liveMatchByKey`, `localColumns`, `toRemoteRow`
- [ ] Mutations call `recordUpsert` / `recordDelete` / `recordNewRows` in-transaction
- [ ] Drain lane, only if high-churn
- [ ] Tests for outbox, apply, and convergence
