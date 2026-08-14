# Sync Design

How signed-in users get their collections, searches, and preferences mirrored
across devices — without compromising the local-first, offline, self-hostable,
open-source tenets in `CLAUDE.md`.

Companion docs: `data_boundaries.md` (ownership/imports — this doc extends its
table) and `technical_requirements.md` (the stack).

---

## 1. Scope

**Sync mirrors user-owned data only.** The game database (`/scrolled.sqlite3`)
is a derived cache of the user's own game files and never syncs. Only the user
database (`/user.sqlite3`) participates.

### What syncs

| Data | Table |
| --- | --- |
| Collections | `collections` |
| Collection members (notes, qty, done, position) | `collection_members` |
| Collection groups | `collection_groups` |
| Pinned searches | `pinned_searches` |
| Home layout, accent colour, theme override, active server profile | `user_settings` |
| Recents (entities + queries) | `recents` (capped, coalesced) |

The active server profile syncs in generic mode only (§5.3).

### What does NOT sync

- **Game/reference data** — the entire game DB.
- **Device-local UI state** — sidebar rail collapsed, section expansion. These
  are screen-real-estate driven and stay in `localStorage`.
- **Theme when set to follow-system** — only an explicit override is a synced
  preference.
- **Game-derived display labels** — `recents.name` is resolved locally and has
  no column in the backend.
- **Caches, derived indexes, transient UI state.**

The litmus test: *sync anything the user would be annoyed to reconfigure on
another device; keep device-local anything driven by the physical device.*

---

## 2. Goals & non-goals

### Goals

- Signed-in users see their data converge across devices, near-real-time.
- The app stays fully usable **offline and signed-out** — sync is additive.
- **No server to run.** The backend is a database with constraints and row-level
  security, not a service. Push is an upsert, pull is a select.
- Sync is reachable behind a **pluggable provider abstraction**, mirroring
  identity, so a self-hosted store is a swap rather than a rewrite.
- Hosted-only code is **droppable from self-hosted builds** (no vendor SDK, no
  vendor strings in the bundle), exactly as `identity-cloud` is.
- Sync **logical records**, never raw SQLite pages.

### Non-goals

- Collaborative multi-user editing of the same collection. Single user, many
  devices; concurrency is rare and low-stakes.
- Syncing game data.
- CRDTs or field-level merge. Record-level last-write-wins is sufficient.

### Tenet check

`CLAUDE.md` tenet 2 forbids a privileged central server the app needs to
function, and tenet 4 requires offline operation. Both hold: the backend is
authoritative **only for a signed-in account's synced data**. Signed out,
self-hosted without sync, or offline, the local DB is authoritative and the app
is fully functional. Sync is opt-in and additive, and nothing the app needs to
run lives there.

---

## 3. Why we build the engine instead of adopting a library

Surveyed RxDB, PowerSync, ElectricSQL, cr-sqlite, and sqlite-sync. Every one
requires either a different WASM SQLite build (we are committed to
`@sqlite.org/sqlite-wasm`) or a privileged central sync service, or both. RxDB's
fast storages are additionally a paid license.

The data that syncs is small — hundreds of rows, single-writer-per-account in
practice — so a hand-rolled engine is a bounded cost, whereas a sync-native store
would mean running two storage paradigms forever, since the game DB stays
relational SQLite regardless.

---

## 4. Architecture

```
                 main thread                          user-DB worker
  ┌────────────────────────────────────┐     ┌──────────────────────────────┐
  │ IdentityProvider                   │     │ UserDbApi                    │
  │   getAccessToken() ─────────┐      │     │   mutations append to outbox │
  │                             │      │     │   drainOutbox()              │
  │ SyncEngine (sync-core)      │ comlink    │   applyRemoteRows()  ──┐     │
  │   - outbox drain + push ◀───┼──────┼────▶│   getSyncMeta()        │     │
  │   - cursor pull + apply     │      │     │   (all in SQLite txns) │     │
  │   - status + backoff        │      │     └────────────────────────┼─────┘
  │           │                 │      │                              │
  │           ▼                 │      │           OPFS /user.sqlite3 ◀┘
  │   SyncProvider (adapter)    │      │
  └───────────┼─────────────────┘      │
              ▼ (dynamic import, build-gated)
        @scrolled/sync-supabase  ──PostgREST + Broadcast WS──▶  Supabase
```

The **engine** runs on the main thread as a coordinator. It awaits network and
comlink — no heavy CPU — so it does not violate "heavy work in a Worker". The
auth token lives in the React-side identity provider, and the only cross-boundary
cost is shipping small batches over comlink; a dedicated sync worker would add
worker-to-worker token plumbing for no gain.

**Only one tab runs an engine.** Every tab mounts `SyncEngineHost`, but they
share one user DB and one outbox, so the host holds a `scrolled-sync-engine` Web
Lock and starts the engine only while it has it. Another tab takes over on
release.

**SQLite work stays in the worker.** The worker returns which TanStack query keys
changed; the engine invalidates them on the main thread (§8).

---

## 5. Data model

### 5.1 Identity is the natural key

This is the central decision, and everything else follows from it.

A record's identity is the same set of columns locally and remotely:

| Entity | Key |
| --- | --- |
| `collection` | `key` (client-minted) |
| `collection_group` | `key` (client-minted) |
| `collection_member` | `(collection_key, entity_type, entity_id)` |
| `pinned_search` | `key` (client-minted) |
| `user_setting` | `key` (the setting's own name) |
| `recent` | `(kind, ref)` |

`ENTITY_KEY_COLUMNS` in `sync-core` is the single definition; the outbox
coalescer, the apply path, and the upsert conflict target all derive from it.
Two devices doing the same thing therefore write the same row, and a duplicate
add collapses structurally rather than by client-side cleanup.

Collections, groups and pinned searches need a minted key because a device must
be able to create one offline and reference it from members before the backend
has seen it. Their user-visible name carries a unique constraint instead (§6).

### 5.2 Local columns

Every synced table carries `uuid` (the key the backend knows it by, unused for
naturally-keyed entities), `remote_seq` (the backend `seq` of the version held),
`updated_at`, `deleted_at`, and `origin_device`. Local integer primary keys are
untouched, so nothing relational is rewired.

`sync_outbox` accumulates pending changes and `sync_cursor` holds the pull
cursor, device id, and account id.

### 5.3 Active server profile

Only the generic profile syncs. A profile derived from the user's own loaded
files is device-specific and stays local.

### 5.4 The mutation chokepoint

Every user-DB write calls `recordUpsert` or `recordDelete` from
`db/user/queries/sync.ts` inside the same transaction as its data change, so the
write and its outbox entry commit atomically and no mutation can escape the
outbox. Deletes are captured before the caller hard-deletes the row, because the
backend keeps a tombstone so other devices learn of the delete.

Cascades need care: `ON DELETE CASCADE` bypasses `recordDelete`, so
`deleteCollection` walks the subtree explicitly.

---

## 6. Conflict model

There is no client-side conflict resolution. Push is an unconditional upsert on
the natural key, so the last writer wins per record, and applying a pulled row is
governed by two rules:

1. Skip it if that record has a queued local edit — the push is about to
   overwrite it anyway.
2. Otherwise apply it if its `seq` is newer than the `remote_seq` held.

The one case needing more than that is a **unique-name collision**: two devices
independently created a collection, group, or pinned search with the same name
under different keys. The backend rejects the second. That rejection is a merge
signal, not an error — the client looks up the key already in use, adopts it
(`rekeyLocal`), re-parents its children, and re-pushes. Members union for free
because they are keyed by entity rather than by a minted id.

Because the whole statement fails on rejection, the adapter retries the batch
row-by-row to isolate which rows collided. Collisions are rare, so the slow path
is acceptable.

---

## 7. The engine

`SyncEngine` in `sync-core` is a state machine with one cycle: handshake, push,
pull.

**Push** drains the outbox, coalesced to one change per record, then upserts
table by table in parent-first order — the backend rejects a member whose
collection it has not seen, so ordering is what keeps that from happening. Name
collisions are resolved and the loop re-drains, because children still queued
reference the key just abandoned. The loop stops when nothing lands and nothing
was rekeyed.

**Pull** pages on `server_time`, starting a configurable overlap window behind
the stored cursor (default 5 minutes). The overlap exists because `nextval` is
not transaction-ordered: a lower `seq` can become visible after a higher one, so
paging on `seq` could skip a row permanently. Re-delivery inside the overlap
costs nothing, since applying is an idempotent natural-key upsert.

**Reconcile** replaces all local synced state from a full snapshot
(`fetchAll` → `replaceAllFromSnapshot`). It runs when the stored cursor predates
the tombstone retention window — at which point a delta pull could miss reaped
deletes — and on the user-facing "Replace from account" action. This is the
recovery path that makes divergence self-healing rather than permanent, at the
cost of any unpushed local change.

**Triggers**: a realtime poke, a debounced local mutation (recents get a slower
lane, since they churn on every page view), a 60s safety tick, and the manual
action. Transient faults back off exponentially with jitter; local writes are
never blocked.

### `SyncProvider`

```ts
interface SyncProvider {
  upsert(entity, rows): Promise<UpsertResult>;      // conflict target = key columns
  fetchSince(cursor): Promise<FetchPage>;
  fetchAll(): Promise<TaggedRow[]>;                 // snapshot reconcile
  findByUnique(entity, where): Promise<RemoteRow | null>;
  gcTombstones(before): Promise<void>;
  subscribe(onPoke): Unsubscribe;
  hello(): Promise<ProtocolHandshake>;
}
```

Every method is a plain table operation, so anything that can upsert by key and
select by cursor can back sync. There is no idempotency ledger: an upsert on a
natural key is idempotent by construction, so a retry after a dropped response is
a no-op.

---

## 8. Reactivity

Applying remote rows returns the TanStack query-key roots that changed, and the
engine invalidates them on the main thread. Those are the same keys local
mutations already invalidate, so a collection edited on one device appears on
another with no changes to any display component.

---

## 9. Tombstones

A delete is an upsert setting `deleted_at`, so an offline device still learns of
it. Locally the row is hard-deleted on apply — keeping a soft tombstone would
leave it visible to every read and keep its unique name reserved.

Tombstone GC is client-driven, because there is no server to schedule it: any
client may reap its own account's tombstones past the retention window (90 days),
which is why the RLS policy grants DELETE.

---

## 10. Bootstrap and "claim local data"

`sync_cursor.account_id` records whose data the DB holds. On the first
authenticated session:

- **resumed** — already this account, nothing to do.
- **adopted** — anonymous data with no prior account. Every live row is queued
  parent-first, so the user's offline work merges with whatever the account
  already holds.
- **reset** — a different account. Local data is discarded so two users never mix
  on one device.

Signing out of the same account does not reset; local data stays for offline use
and the engine stops.

Restoring a backup replaces the whole user SQLite file, including another
install's cursor and queue. `detachSyncAccount` clears them afterwards so the
next sign-in re-adopts the restored rows rather than pushing a foreign cursor,
and the host restarts the engine via a bumped sync epoch.

---

## 11. Backend

Six per-account tables mirroring the local schema, in
`supabase/migrations/20260814000000_sync_relational.sql`. Because the backend's
constraints and the client's constraints are the same set, applying a pulled row
can never violate a local constraint.

| Table | Primary key | Unique | Foreign key |
| --- | --- | --- | --- |
| `sync_collections` | `(account_id, key)` | `(account_id, name)` where live | — |
| `sync_collection_groups` | `(account_id, key)` | `(account_id, collection_key, name)` where live | → collections |
| `sync_collection_members` | `(account_id, collection_key, entity_type, entity_id)` | — | → collections |
| `sync_pinned_searches` | `(account_id, key)` | `(account_id, name)` where live | — |
| `sync_user_settings` | `(account_id, key)` | — | — |
| `sync_recents` | `(account_id, kind, ref)` | — | — |

The unique name indexes are partial on `deleted_at is null`, so a tombstone never
reserves a name. `group_key` on members deliberately has no foreign key: deleting
a group re-parents its members client-side, and a briefly dangling key renders as
ungrouped and self-heals.

Two trigger-stamped columns, each doing one job. `seq` from a global sequence is
the per-row staleness comparator; `server_time` is the pull cursor. Do not
collapse them — see the ordering hazard in §7.

The only server-side code is two trigger functions: one stamping those columns,
one calling `realtime.send()` for the doorbell.

### Realtime is a doorbell

Broadcast on a private `sync:<account_id>` channel, not `postgres_changes`, which
re-runs RLS per subscriber on a single thread and does not apply RLS to DELETE
events. The poke carries no row data — only the writing device, so a client can
ignore its own echo — and a missed message costs latency, never data.

---

## 12. Security and tenant isolation

`account_id` defaults to `auth.uid()` and one RLS policy per table covers all
four verbs, with `using` scoping reads and `with check` refusing an insert or
update naming any other account. This is the declarative equivalent of deriving
the tenant in application code, and it is why the adapter never names a tenant.

Realtime subscription is gated by RLS on `realtime.messages`, so a guessed
channel name authorizes nothing.

---

## 13. Packages and boundaries

```
@scrolled/sync-core      protocol types, SyncProvider interface, the SyncEngine,
                         the rekey/merge resolver, React status context (/react).
                         Ships in EVERY build. No network SDK.

@scrolled/sync-supabase  the first transport adapter, over PostgREST + Realtime.
                         Hosted builds only — dynamic-imported and
                         dead-code-eliminated from self-hosted bundles.
                         → deps: sync-core, @supabase/supabase-js
```

Extends the `data_boundaries.md` ownership table:

| Concern | Owner | May import |
| --- | --- | --- |
| sync protocol, engine, merge resolver, status hooks | `sync-core` | (leaf) |
| concrete Supabase sync transport | `sync-supabase` | sync-core, supabase-js |
| **choosing the sync provider** | `apps/web` (`sync/` only) | sync-core, sync-supabase (dynamic) |
| local sync metadata (outbox, cursor) | `apps/web/db/user` | game-db/db (sqlite only) |

Lint enforces that display dirs (`components/` except `wizard/`, `routes/`,
`lib/`, `search/`) and `sync-core` cannot import `@scrolled/sync-supabase` or
`@supabase/*`. The sole exception is `apps/web/src/sync/`. The core app is
**sync-aware but not provider-aware** — it consumes `useSyncStatus()` and nothing
else.

---

## 14. Config

`VITE_SYNC_MODE=supabase` requires `VITE_IDENTITY_MODE=cloud`, since sync scopes
data to an account, and reuses the identity's Supabase project rather than taking
its own URL and key. `packages/config` resolves and validates both;
`__SYNC_SUPABASE__` gates the dynamic import.

---

## 15. Versioning

`PROTOCOL_VERSION` in `sync-core` is exchanged through `hello()`, which reads the
`sync_protocol` table. A client below `min_client_revision` surfaces a
non-retryable "please refresh" rather than corrupting data.

v3 is the relational protocol. It is not compatible with v2's append-only jsonb
log, so `min_client_revision` moved to 3 at the same time.

Local schema changes are ordinary user-DB migrations, appended and never
reordered. They are independent of the game DB's schema version and data
revision.

---

## 16. Self-hosted (future)

A single-tenant store implementing `SyncProvider` — the interface is already just
"upsert by key, select by cursor", which a plain SQLite file or a small HTTP
service can satisfy. Token auth normalizes to a `default` account; SSE replaces
the Broadcast doorbell. The engine and `sync-core` are unchanged.
