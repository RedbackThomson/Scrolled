# Sync Design

How signed-in users get their collections, searches, and preferences mirrored
across devices and browser sessions in real time — without compromising the
local-first, offline, self-hostable, open-source tenets in `CLAUDE.md`.

This is the consolidating design doc the high-level architecture brief
anticipated. It is meant to be read once, end to end, so every change the sync
work introduces is understood from the outset. Companion docs:
`data_boundaries.md` (ownership/imports — this doc extends its table) and
`technical_requirements.md` (the stack).

Status: **design approved, not yet built.** Phases below are the implementation
plan, not shipped state.

---

## 1. Scope

**Sync mirrors user-owned data only.** The game database (`/scrolled.sqlite3`)
is a derived cache of the user's own game files and never syncs — it is rebuilt
locally or installed from a dataset. Only the user database
(`/user.sqlite3`) participates.

### What syncs

| Data | Where it lives today | Change |
| --- | --- | --- |
| Collections | `collections` (user DB) | + sync columns |
| Collection members (notes, qty, done, position) | `collection_members` | + sync columns |
| Collection groups | `collection_groups` | + sync columns |
| Pinned searches | `pinned_searches` | + sync columns |
| Home layout | `ui_prefs` → `user_settings` | relocate, synced |
| Accent colour | `localStorage` | → `user_settings`, synced |
| Theme override | `localStorage` | → `user_settings`, synced; **follow-system is the default**, only an explicit light/dark choice syncs |
| Recents (entities + queries) | `idb-keyval` | → `recents` table, synced (capped, coalesced) |
| Active server profile | game DB `server_profile.profile_id` | → `user_settings`, synced — **generic mode only** (see §6.4) |

### What does NOT sync

- **Game/reference data** — items, mobs, maps, etc. (the entire game DB).
- **Device-local UI state** — sidebar rail collapsed, sidebar section
  expansion. These are screen-real-estate driven; they stay in `localStorage`.
- **Theme when set to follow-system** — only an explicit override is a synced
  preference; "follow the OS" is the per-device default.
- **Caches, derived indexes, transient UI state.**

The litmus test that produced this split: *sync anything the user would be
annoyed to reconfigure on another device or session; keep device-local anything
driven by the physical device (screen size, OS theme).*

---

## 2. Goals & non-goals

### Goals

- Signed-in users see their data converge across devices, near-real-time.
- The app stays fully usable **offline and signed-out** — sync is additive.
- Sync is reachable behind a **pluggable provider abstraction**, mirroring
  identity: Supabase first, a self-hosted single-tenant server later, without
  touching the core app.
- Hosted-only / Supabase code is **droppable from self-hosted builds** (no
  vendor SDK, no vendor strings in the bundle), exactly as `identity-cloud` is.
- Sync **logical records**, never raw SQLite pages.

### Non-goals (v1)

- Collaborative multi-user editing of the same collection. (Single user, many
  devices. Concurrency is rare and low-stakes.)
- Syncing game data.
- CRDTs / field-level merge. Record-level last-write-wins is sufficient for this
  data; see §7.
- A hosted sync server we operate beyond Supabase. (Supabase needs no server of
  ours; the self-hosted server is a later phase.)

---

## 3. Why we build the engine instead of adopting a library

Surveyed RxDB, PowerSync, ElectricSQL, cr-sqlite, and sqlite-sync. **Every one
forces a tenet or stack break:** they require either a different WASM SQLite
build (we are committed to `@sqlite.org/sqlite-wasm` — `technical_requirements.md`)
or a privileged central sync service (breaks self-hostable + offline), or both.
RxDB's fast storages are additionally a paid license, which collides with
open-source-first.

The data that syncs is small (hundreds of rows) and single-writer-per-account in
practice, so a hand-rolled engine is a bounded, one-time cost — whereas adopting
a sync-native store would mean running **two storage paradigms** forever (the
game DB stays relational SQLite regardless), which is *more* architectural
surface, not less.

**What we take from the prior art:** RxDB's checkpoint-replication *protocol
design* is openly documented (Apache-licensed, separate from its premium
storages) precisely so anyone can implement it. We adopt its shape — a
deliberately simple backend reached through a cursor pull, a push, and a change
stream, with conflict resolution on the client — on top of the SQLite we already
have. No new heavy dependency, no paradigm split, relational model intact.

---

## 4. Architecture overview

```
                 main thread                          user-DB worker
  ┌────────────────────────────────────┐     ┌──────────────────────────────┐
  │ IdentityProvider (existing)         │     │ UserDbApi (existing + new)    │
  │   getAccessToken() ─────────┐       │     │   mutations append to outbox  │
  │                             │       │     │   drainOutbox()               │
  │ SyncEngine (sync-core)      │       │comlink  applyRemoteChanges() ──┐    │
  │   - outbox drain loop ◀─────┼───────┼────▶│   getSyncMeta()          │    │
  │   - pull/push orchestration │       │     │   (all in SQLite txns)   │    │
  │   - conflict resolution     │       │     └──────────────────────────┼────┘
  │   - status + backoff        │       │                                │
  │           │                 │       │           OPFS /user.sqlite3 ◀─┘
  │           ▼                 │       │
  │   SyncProvider (adapter)    │       │
  │     push / pull / subscribe │       │
  └───────────┼─────────────────┘       │
              ▼ (dynamic import, build-gated)
        @scrolled/sync-supabase  ──HTTP/RPC + Broadcast WS──▶  Supabase
```

- The **engine** (`sync-core`) runs on the **main thread** as a coordinator. It
  awaits network and comlink — no heavy CPU — so it does not violate "heavy work
  in a Worker." It pulls the access token from the existing `IdentityProvider`
  and drives the adapter.
- **SQLite work stays in the user-DB worker.** New `UserDbApi` methods read the
  outbox and apply remote batches inside transactions. The worker tells the
  engine which TanStack query keys changed; the engine invalidates them on the
  main thread → UI updates (§9).
- The **adapter** (`SyncProvider`) is the only place that knows about Supabase.
  It is dynamic-imported behind a build constant and dropped from self-hosted
  builds.

Why the orchestrator is on the main thread and not its own worker: the auth
token lives in the React-side identity provider, and the only cross-boundary
cost is shipping small change batches over comlink. A dedicated sync worker would
add worker→worker token plumbing for no real gain; revisit only if profiling
shows main-thread jank.

---

## 5. Packages & boundaries

Two new packages, mirroring the identity split exactly:

```
@scrolled/sync-core    leaf-ish — protocol types, SyncProvider interface,
                       the SyncEngine state machine, conflict handler,
                       React status context/hooks (/react subpath).
                       Ships in EVERY build. No network SDK.
                       → deps: (none beyond react peer for /react)

@scrolled/sync-supabase  → deps: sync-core, identity-core, @supabase/supabase-js
                       The first transport adapter. Implements SyncProvider over
                       Supabase RPC (push/pull) + Realtime Broadcast (subscribe).
                       Hosted builds only — dynamic-imported, dead-code-eliminated
                       from self-hosted bundles.
```

Deferred to the self-hosted phase (§16): `sync-server`, `sync-storage`,
`sync-storage-sqlite`. Not created now.

### Extends `data_boundaries.md`

New rows for its ownership table:

| Concern | Owner | May import |
| --- | --- | --- |
| sync protocol, engine, conflict handler, status hooks | `sync-core` | (leaf) |
| concrete Supabase sync transport | `sync-supabase` | sync-core, identity-core, supabase-js |
| **choosing the sync provider** | `apps/web` (`sync/` only) | **sync-core, sync-supabase (dynamic)** |
| local sync metadata (outbox, cursor, tombstones) | `apps/web/db/user` | game-db/db (sqlite only) |

### Lint rules (added to `eslint.config.js`)

The same shape as the identity rules. Display dirs (`components/` except
`wizard/`, `routes/`, `lib/`, `search/`) **and `sync-core`** cannot import
`@scrolled/sync-supabase` or `@supabase/*`. The sole exception is
`apps/web/src/sync/`, the sanctioned bootstrap shim. This keeps the core app
**sync-aware but not provider-aware** — it consumes `useSyncStatus()` and
nothing else.

---

## 6. Local data model

All changes are **new user-DB migrations** appended after version 5
(`apps/web/src/db/user/migrations.ts`), same forward-only runner. The user DB has
its own version namespace, independent of the game DB.

### 6.1 Sync columns on every synced table

Each synced row gains the contract fields from the architecture brief §7:

```sql
-- added to: collections, collection_members, collection_groups, pinned_searches
ALTER TABLE <t> ADD COLUMN uuid        TEXT    NOT NULL DEFAULT '';   -- stable cross-device id
ALTER TABLE <t> ADD COLUMN revision    INTEGER NOT NULL DEFAULT 0;    -- bumped on every local write
ALTER TABLE <t> ADD COLUMN updated_at  INTEGER NOT NULL DEFAULT 0;    -- wall-clock HINT only (most already have this)
ALTER TABLE <t> ADD COLUMN deleted_at  INTEGER;                       -- tombstone; NULL = live
ALTER TABLE <t> ADD COLUMN origin_device TEXT NOT NULL DEFAULT '';    -- device that authored the current revision
```

**Why a `uuid` alongside the existing `INTEGER PRIMARY KEY AUTOINCREMENT`:**
autoincrement ids collide across devices (both devices mint `id=7`). The `uuid`
is the cross-device identity used on the wire and for conflict resolution; the
integer PK stays the local-only key that foreign keys already reference, so no
relational rewiring. The migration backfills `uuid` for existing rows
(`randomblob`-derived) and stamps `revision=1`, `updated_at=now`,
`origin_device=<this device>`.

Members/groups reference their parent by the parent's **uuid** on the wire, even
though locally they still join on the integer FK.

### 6.2 `user_settings` — synced key/value (replaces `ui_prefs` for synced prefs)

```sql
CREATE TABLE user_settings (
  key           TEXT PRIMARY KEY,        -- e.g. 'accent', 'theme', 'home.layout', 'activeServerProfile'
  value         TEXT NOT NULL,           -- JSON-encoded; each consumer owns its zod schema
  uuid          TEXT NOT NULL DEFAULT '',
  revision      INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL DEFAULT 0,
  deleted_at    INTEGER,
  origin_device TEXT NOT NULL DEFAULT ''
);
```

`ui_prefs` content (`home.layout`) migrates into `user_settings`; `ui_prefs` is
dropped. Accent and the explicit theme override migrate out of `localStorage` on
first run by a one-time client-side shim (read old key → write setting → clear
old key). Device-local prefs (sidebar) stay in `localStorage`.

### 6.3 `recents` — synced, capped, coalesced

```sql
CREATE TABLE recents (
  kind          TEXT NOT NULL CHECK (kind IN ('entity','query')),
  ref           TEXT NOT NULL,           -- 'item:1302000' for entity, the raw query string for query
  viewed_at     INTEGER NOT NULL,
  uuid          TEXT NOT NULL DEFAULT '',
  revision      INTEGER NOT NULL DEFAULT 0,
  updated_at    INTEGER NOT NULL DEFAULT 0,
  deleted_at    INTEGER,
  origin_device TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (kind, ref)
);
```

Recents are higher-churn than settings (a write per entity view). To avoid outbox
spam, recents writes are **coalesced**: re-viewing an entity is an `updated_at`
bump on an existing row, and the engine drains recents on a **lower-priority,
debounced** cadence (§8). The list stays capped (30 entities / 15 queries) by
local pruning; pruned rows become tombstones so the cap converges across devices.
LWW per `(kind, ref)` means the most-recently-viewed timestamp wins — exactly the
desired merge.

### 6.4 Active server profile — generic mode only

The active profile relocates from the game DB to `user_settings`
(`key='activeServerProfile'`), **but only generic deployments read or sync it.**
In `fixed-hosted-dataset` mode the dataset's baked-in inline profile is always
authoritative and never user-overridable (see `data_boundaries.md` — the dataset
*is* the profile), so the setting is ignored there and never written.

Resolution gets a mode check in front of it:

```ts
const activeProfileId =
  appConfig.deploymentProfile === 'fixed-hosted-dataset'
    ? datasetInlineProfile.id            // game DB, authoritative, not synced
    : userSettings.activeServerProfile;  // user DB, synced
```

Consequence: the game DB's `server_profile.profile_id` column becomes generic-mode
dead weight once selection moves. We drop it in a game-DB migration to keep one
source of truth (the inline `profile_json` for fixed mode stays). This is a
schema-only change — no data-revision bump (it doesn't touch extraction output).

### 6.5 Sync bookkeeping tables

```sql
CREATE TABLE sync_outbox (
  seq           INTEGER PRIMARY KEY AUTOINCREMENT,  -- local order
  entity        TEXT NOT NULL,        -- 'collection' | 'collection_member' | ... | 'user_setting' | 'recent'
  uuid          TEXT NOT NULL,        -- the record's cross-device id
  op            TEXT NOT NULL CHECK (op IN ('upsert','delete')),
  payload       TEXT NOT NULL,        -- JSON snapshot of the record at write time
  base_revision INTEGER NOT NULL,     -- record revision this write was based on (for optimistic concurrency)
  created_at    INTEGER NOT NULL,
  idempotency   TEXT NOT NULL         -- unique key for at-least-once retry dedup
);

CREATE TABLE sync_cursor (
  id            INTEGER PRIMARY KEY CHECK (id = 1),  -- singleton
  server_seq    INTEGER NOT NULL DEFAULT 0,          -- last server change seq applied
  device_id     TEXT NOT NULL,                       -- this install's stable device id
  account_id    TEXT                                 -- whose data this DB currently holds (see §11 bootstrap)
);

CREATE TABLE sync_state (
  key           TEXT PRIMARY KEY,     -- 'status','lastSyncedAt','lastError'
  value         TEXT NOT NULL
);
```

`sync_tombstones` from the brief is **not** a separate table — a tombstone is
just a synced row with `deleted_at` set and a bumped `revision`. It replicates
like any other change and is hard-deleted locally only after its delete has been
acked and is older than the retention window (§10).

### 6.6 The mutation chokepoint

All ~22 user mutations already funnel through `UserDbApi`
(`apps/web/src/db/user/queries/`). Each mutation gains, **inside its existing
transaction**:

1. bump `revision`, set `updated_at = now`, `origin_device = <this device>`;
2. mint `uuid` on insert;
3. append one `sync_outbox` row capturing the post-write snapshot + `base_revision`.

This is the single most important invariant: **the data write and its outbox
entry commit atomically.** No mutation can escape the outbox; a crash can't leave
them inconsistent. A small `withOutbox(entity, op, fn)` helper wraps each
mutation so this is one line per call site, not duplicated logic.

---

## 7. Conflict model — server-ordered revision last-write-wins

Per-record LWW, but the **server is the arbiter of order** so client clock skew
can never corrupt state. (Pure `updated_at` LWW — the brief's first sketch — is
the trap; wall clocks drift between devices.)

### Mechanics

- Each record has a monotonic integer `revision`, **assigned by the server**.
- A push carries `base_revision` (the revision the edit was based on). The server
  accepts the write only if `base_revision == current server revision` for that
  record; otherwise it returns **409 Conflict** with the current server record.
  This is optimistic concurrency, like RxDB's revision check.
- On accept, the server sets `revision = base_revision + 1`, stamps a global
  per-account `server_seq` (the total order / pull cursor), and appends to the
  change log.
- **`updated_at` is never the integrity comparator** — only a tiebreaker *hint*
  for the client's merge decision on conflict, with `origin_device` as the final
  deterministic tiebreak.

### Conflict resolution (client `conflictHandler`)

When a push is rejected 409, or a pull delivers a remote change for a row with a
pending local edit:

```
remote = server's current record
local  = our pending edit
winner =
  remote.deleted_at && !local.deleted_at ? (delete-wins? configurable) :
  local.updated_at  >  remote.updated_at ? local  :
  local.updated_at  <  remote.updated_at ? remote :
  local.origin_device > remote.origin_device ? local : remote   // deterministic tie
if winner == local:  re-push local with base_revision = remote.revision  (lands on top)
else:                apply remote locally, drop the local pending edit
```

Clock skew can make LWW pick the "wrong" intent in a true concurrent edit, but it
**never corrupts** — revisions stay monotonic and both devices converge to the
same winner. For collections/searches/settings this is entirely acceptable; there
is no concurrent multi-user editing to protect.

The handler is a `sync-core` function with a sensible default, overridable
per-entity (e.g. recents always take the max `viewed_at` rather than asking;
deletes of a collection are delete-wins).

---

## 8. The sync engine (`sync-core`)

A small state machine on the main thread. Responsibilities, in order:

1. **Idle → Syncing trigger** from any of: app start (signed in), a local
   mutation enqueued (debounced ~1s), a realtime poke (§ adapter `subscribe`), a
   manual "sync now," or a periodic safety tick (~60s) in case the realtime
   channel dropped.
2. **Push**: `drainOutbox(limit)` from the worker → `provider.push(batch)`.
   Each change carries its `idempotency` key so a retried batch is deduped
   server-side (Stripe-style: server stores key + first outcome, returns it on
   replay). On success, `markOutboxSynced(seqs, assignedRevisions)`. On 409s,
   run the conflict handler and re-enqueue losers.
3. **Pull**: `provider.pull(cursor.server_seq)` → returns changes after the
   cursor + a `nextCursor`. `applyRemoteChanges(batch)` in the worker applies
   them in **one transaction**, running the conflict handler against any locally
   pending rows, and advances `server_seq` **atomically with the applied rows**
   (so a crash mid-apply never skips changes). Returns the set of affected
   TanStack query keys.
4. **Invalidate** those keys on the main thread → UI re-renders (§9).
5. **Status**: publish `{ state, lastSyncedAt, pendingChanges, error }` to the
   `sync-core` React context.

**Retry/backoff**: network failures retry with exponential backoff + jitter;
auth failures (401) ask the identity provider to refresh the token and retry
once, else surface "session expired." Backoff never blocks the UI or local
writes — the app keeps working offline; the outbox just grows.

**Priority lanes**: settings/collections drain immediately (debounced 1s);
recents drain on a lazy 10–15s timer so view-churn doesn't dominate traffic.

**Bootstrap** (first sync for an account): see §11.

### `SyncProvider` interface (the abstraction)

```ts
export interface SyncChange {
  entity: SyncEntity;            // 'collection' | 'collection_member' | … | 'user_setting' | 'recent'
  uuid: string;
  op: 'upsert' | 'delete';
  payload: unknown;              // record snapshot (validated by zod at the boundary)
  baseRevision: number;
  idempotency: string;
}

export interface PushResult {
  applied: { uuid: string; revision: number; serverSeq: number }[];
  conflicts: { uuid: string; remote: SyncChange & { revision: number } }[];
}

export interface PullResult {
  changes: (SyncChange & { revision: number; serverSeq: number })[];
  nextCursor: number;
  hasMore: boolean;              // for paginated bootstrap
}

export interface SyncProvider {
  /** Push a batch; server assigns revisions/seqs and reports conflicts. */
  push(changes: SyncChange[]): Promise<PushResult>;
  /** Pull all changes after `cursor`, paginated. */
  pull(cursor: number): Promise<PullResult>;
  /** Live "there are new changes, pull now" doorbell. No-op-able. */
  subscribe(onPoke: () => void): Unsubscribe;
  /** Protocol/compat handshake; lets the server reject incompatible clients. */
  hello(): Promise<{ protocolVersion: number; minClientRevision: number }>;
}
```

The engine never knows whether `push` hit Supabase RPC or a self-hosted Express
route, nor whether `subscribe` is a Supabase Broadcast channel or an SSE stream.
Auth is injected: the adapter is constructed with a `getAccessToken` thunk
sourced from the `IdentityProvider` (the `getAccessToken()` already stubbed on it
for exactly this).

---

## 9. Reactivity — remote changes show up live

Today, local mutations invalidate broad TanStack keys (`['user','collections']`,
etc.). Remote changes reuse the same machinery: `applyRemoteChanges` returns the
affected key roots, and the engine calls `queryClient.invalidateQueries` for each.
A collection edited on device A lands on device B's screen within the
pull-after-poke latency (sub-second on a live Broadcast channel) with **zero
changes to any display component** — they already react to those query keys. No
RxJS, no observable-query rewrite.

---

## 10. Tombstones & garbage collection

- Deletes are tombstones (`deleted_at` + bumped revision), so deletion replicates
  and a long-offline device learns about deletions it missed.
- **Server retention**: tombstones live in the change log for a retention window
  (proposed **90 days**) long enough for any realistic offline client to
  reconcile, then GC'd. A device offline longer than the window can miss a delete;
  the safety net is the cursor-staleness check (§15): if a client's cursor is
  older than the GC horizon, the server tells it to **re-bootstrap** rather than
  delta-pull, guaranteeing convergence.
- **Local GC**: a tombstoned row is hard-deleted locally once its delete is acked
  and older than the window, so the user DB doesn't grow unbounded.

---

## 11. Bootstrap & "claim local data"

The interesting case: a user used the app **anonymously**, built collections, then
signs in. We must not lose their local data, nor duplicate it on every device.

- `sync_cursor.account_id` records whose data the local DB currently holds.
- **First sign-in on a device with local data and no prior account** (`account_id`
  is null): adopt the local data into the account. Every existing row is enqueued
  as an `upsert` (it already has a `uuid`), `account_id` is set, then a normal
  push/pull runs. Server-side LWW merges it with anything already there.
- **Signing into an account that already has server data, on a fresh device**
  (empty local DB): pull from cursor 0, paginated, applying in transactions.
- **Switching accounts / signing out then into a different account**: the local
  user DB is reset (the account's data is on the server) to avoid mixing two
  users' data. Signing out of the *same* account leaves local data intact for
  offline use.

User data is small, so the "large initial bootstrap" concern is minor, but `pull`
is paginated (`hasMore`) so even a big account streams in batches without holding
everything in memory at once.

---

## 12. Supabase backend (`sync-supabase` adapter + Postgres)

### Server schema (Postgres, via Supabase migrations)

```sql
-- one row per logical user-owned record, current state, scoped by account
create table sync_records (
  account_id    uuid not null,                 -- = auth.uid(); the tenant
  entity        text not null,
  uuid          text not null,
  op            text not null,                  -- 'upsert' | 'delete'
  payload       jsonb not null,
  revision      int  not null,
  origin_device text not null,
  updated_at    bigint not null,               -- client hint, stored not trusted
  server_seq    bigint not null,               -- assigned here; total order per account
  server_time   timestamptz not null default now(),
  primary key (account_id, entity, uuid)
);
create index on sync_records (account_id, server_seq);

-- monotonic per-account sequence source
create table sync_account_seq (
  account_id uuid primary key,
  last_seq   bigint not null default 0
);

-- idempotency ledger for at-least-once push retries
create table sync_idempotency (
  account_id  uuid not null,
  key         text not null,
  result      jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (account_id, key)
);
```

### Push/pull as RPCs, not raw table writes

Push goes through a **`security definer` Postgres function** (`sync_push`), not
direct table DML, because the write path must atomically: check `base_revision`
(409 on mismatch), assign `revision`+`server_seq`, dedup on idempotency key, and
**derive `account_id` from `auth.uid()`** — never from client input. This is the
defense against tenant-id spoofing (§14): the client *cannot* name a tenant; the
JWT does. Pull is a function (`sync_pull(cursor)`) returning rows where
`account_id = auth.uid() and server_seq > cursor` ordered by `server_seq`,
paginated.

### Realtime is a doorbell, via Broadcast (not `postgres_changes`)

The research is decisive here. **Use Realtime Broadcast on a private per-account
channel; do not use `postgres_changes`:**

- `postgres_changes` re-runs RLS **per subscriber per change on a single thread**
  — 100 devices = 100 RLS checks per insert; it does not scale and compute
  upgrades don't help.
- `postgres_changes` **does not apply RLS to DELETE events**, leaking deleted-row
  keys across tenants — fatal for a tombstone-based design.

Instead, a Postgres trigger on `sync_records` calls
`realtime.broadcast_changes()` onto a channel named per account (e.g.
`sync:<account_id>`). Channel access is gated by an **RLS policy on
`realtime.messages`** so only the owning account can subscribe. The broadcast
payload carries **no row data — just a poke** ("seq advanced"); the client
responds by calling `sync_pull` over the authenticated RPC, which is already
RLS-scoped. This keeps the change content on the authorized pull path and the
realtime layer thin, cheap, and swappable.

> Note: Broadcast-from-database (`realtime.broadcast_changes()`, RLS on
> `realtime.messages`) is a 2024–2026 Supabase feature set; re-verify against
> current docs at implementation time.

### Adapter shape

`createSupabaseSyncProvider({ getAccessToken })` returns a `SyncProvider`:
`push`/`pull` call the RPCs with the bearer token; `subscribe` opens the private
Broadcast channel and invokes `onPoke` on message; `hello` reads a protocol
version row. It is dynamic-imported from `apps/web/src/sync/createProvider.ts`
behind `__SYNC_SUPABASE__`, exactly like `identity-cloud`.

---

## 13. Config & bootstrap wiring

### `@scrolled/config` additions

```ts
export type SyncMode = 'off' | 'supabase';

export interface SyncConfig {
  mode: SyncMode;                 // 'off' is the baseline; no sync code reachable
}

// AppConfig gains:
//   sync: SyncConfig;
//   features.sync: boolean;      // show sync status UI

// resolveSync(env): 'off' unless VITE_SYNC_MODE === 'supabase'.
// Guard: sync requires identity.mode === 'cloud' (no account → nothing to scope
// data to) and reuses the existing Supabase URL/key — throws on misconfig,
// matching resolveIdentity's loud-fail style.
```

`VITE_SYNC_MODE=supabase` flips `__SYNC_SUPABASE__` in `vite.config.ts` (next to
`__IDENTITY_CLOUD__`), so self-hosted/forked builds that set nothing never bundle
the adapter or `@supabase/*` for sync.

### Bootstrap

`apps/web/src/sync/createProvider.ts` (new, the sanctioned shim):

```ts
export async function createSyncProvider(
  identity: IdentityProvider,
): Promise<SyncProvider | null> {
  if (!__SYNC_SUPABASE__ || appConfig.sync.mode !== 'supabase') return null;
  const { createSupabaseSyncProvider } = await import('@scrolled/sync-supabase');
  return createSupabaseSyncProvider({ getAccessToken: () => identity.getAccessToken() });
}
```

`main.tsx` mounts a `<SyncEngineHost provider={…} session={…}>` alongside the
existing `IdentityProviderHost`; the engine starts/stops as the session becomes
authenticated/anonymous.

---

## 14. Security & tenant isolation

- **Tenant = `auth.uid()`, always derived server-side.** Clients never send an
  account/tenant id; the `sync_push`/`sync_pull` functions read it from the JWT.
  A spoofed payload field is ignored.
- **RLS on every table** (`sync_records`, `sync_idempotency`, and
  `realtime.messages` for the channel) restricts rows to `account_id = auth.uid()`.
- **Realtime authorization** gates channel subscription via RLS on
  `realtime.messages`, and the broadcast carries no data — so even a channel-name
  guess leaks nothing.
- **Publishable key is public by design** (already true for identity; guarded by
  RLS, not secrecy).
- **Self-hosted single-tenant** (future) normalizes to a `default` account and
  may use a shared token instead of OAuth; the same RLS-by-context shape applies
  with the context fixed.

---

## 15. Versioning & compatibility

Three independent versions now coexist; keep them straight:

- **User-DB schema version** (`_migrations` in the user DB) — local SQL shape.
  Sync columns/tables are appended migrations. Forward-only.
- **Sync protocol version** (`sync-core` constant, exchanged via `hello()`) — the
  wire contract. The server rejects clients below `minClientRevision` with a
  structured error; the client surfaces a clear "please refresh/upgrade" message
  rather than corrupting data.
- **Game-DB schema + data revisions** — unchanged by sync, except the one
  schema-only migration dropping `server_profile.profile_id` (§6.4). No
  data-revision bump.

**Cursor staleness**: if a client's `server_seq` predates the server's tombstone
GC horizon (§10), `sync_pull` returns a "re-bootstrap required" signal instead of
a partial delta, so a very stale device can't silently miss deletes.

---

## 16. Implementation phases

Each phase is independently shippable and leaves the app fully working.

### Phase 1 — Local sync foundations (no network)
- User-DB migrations: sync columns, `user_settings`, `recents`, `sync_outbox`,
  `sync_cursor`, `sync_state`; drop `ui_prefs` into `user_settings`.
- `withOutbox` wrapper on all `UserDbApi` mutations; uuid/revision/tombstone
  bookkeeping.
- Migrate accent + explicit theme + home layout off `localStorage`; relocate
  active server profile (generic mode) off the game DB; wire the fixed-mode check.
- Migrate recents off `idb-keyval` into the `recents` table.
- Game-DB migration dropping `server_profile.profile_id`.
- No behaviour change for the user yet; outbox simply accumulates. **Verifiable
  in isolation** (outbox rows appear on mutation; nothing leaves the device).

### Phase 2 — Protocol & engine (`sync-core`, mock provider)
- The `SyncProvider` interface, `SyncChange`/`PushResult`/`PullResult` types,
  zod schemas, protocol version, conflict handler, the engine state machine,
  status context/hooks.
- New `UserDbApi` methods: `drainOutbox`, `markOutboxSynced`, `applyRemoteChanges`,
  sync-meta getters.
- An **in-memory mock `SyncProvider`** for tests — drives full push/pull/conflict
  paths with no backend. Vitest coverage of LWW, 409 reconciliation, tombstone
  convergence, idempotent retry.

### Phase 3 — Supabase round-trip (`sync-supabase`, pull-based)
- Postgres schema + `sync_push`/`sync_pull` `security definer` functions + RLS +
  idempotency ledger (Supabase migrations, checked into the repo).
- The adapter's `push`/`pull`/`hello`; config + build-constant + bootstrap shim.
- Bootstrap/"claim local data" flow.
- Liveness via **polling** (the 60s safety tick) at first — correctness without
  realtime. End-to-end multi-device sync works here, just not instant.

### Phase 4 — Realtime doorbell (Broadcast)
- Trigger → `realtime.broadcast_changes()` on `sync:<account_id>`; RLS on
  `realtime.messages`; adapter `subscribe`.
- Sub-second cross-device propagation.

### Phase 5 — UI & hardening
- Sync status surfaces (navbar indicator, Settings → Sync section, per-collection
  synced/local-only hint), error states (session expired, server unreachable,
  incompatible protocol). All copy follows `writing_conventions.md` (no
  trademarked names).
- Tombstone GC job + cursor-staleness re-bootstrap path.
- Account-switch reset; device id surfaced for a future device list.
- Command-palette entries (sync now, sign-in prompt) per
  `command_palette_extension_guide.md`.

### Phase 6 — Self-hosted single-tenant (future, separate effort)
- `sync-server` + `sync-storage`/`sync-storage-sqlite`; token auth normalizing to
  a `default` account; SSE for the `subscribe` doorbell. The engine and `sync-core`
  are unchanged — only a second adapter and a server appear.

---

## 17. Open questions (resolve during implementation)

- **Theme default semantics**: confirm "follow-system" is a non-synced sentinel
  vs. an explicit synced `'light'|'dark'`. (Design assumes: absence of a synced
  override ⇒ follow system per device.)
- **Recents drain cadence**: 10–15s debounce is a starting guess; tune against
  real view-churn so recents don't dominate the change log.
- **Tombstone retention window**: 90 days proposed; validate against expected
  max offline duration before committing the GC horizon.
- **Bulk operations** (`bulkAddMembers`, `reorderGroups`) produce many outbox
  rows; consider a batched outbox entry to keep reorder/bulk pushes compact.
