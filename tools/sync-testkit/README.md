# sync-testkit

Runs the app against a **local Supabase stack** so cross-device sync can be
exercised for real: two windows, one account, actual convergence.

Not a published package — repo-internal tooling, which is why it lives in
`tools/` rather than `packages/`.

The stack is the genuine article: real Postgres running the migrations in
`supabase/migrations/`, real PostgREST, real GoTrue, real Realtime. That matters
— a hand-written stand-in for those cannot catch a constraint that does not
behave the way the client assumes, and both bugs found while building this were
of exactly that kind.

## Setup

Needs a Docker daemon (Docker Desktop, OrbStack, colima — anything the Supabase
CLI can reach).

```bash
nix develop -c supabase start
```

First run pulls a few GB of images. Then:

```bash
nix develop -c pnpm supabase:seed
```

That creates the test accounts, writes `apps/web/.env.supabase` with the running
stack's URL and publishable key, and prints the sign-in snippet.

## Two devices

Start the app:

```bash
nix develop -c pnpm dev:supabase
```

Open it twice, on **different origins** — `http://localhost:5173` and
`http://127.0.0.1:5173`. Same app, but the browser gives each origin its own
storage, so each window gets its own local database and device id. That is what
makes them two devices rather than two tabs.

Sign each window in by pasting the snippet `pnpm supabase:seed` printed into the
console. Both land on the same account.

Sign-in goes through the console rather than the app's button because the app
only offers OAuth, and a local OAuth provider would have to be reachable at the
same URL from both the browser and the GoTrue container — which in practice means
baking a machine-specific address into committed config. `signInWithPassword`
against real GoTrue avoids that and needs no change to the app.

## What to check

Worth exercising, since each of these was broken under the previous design:

- Create a collection in one window; it appears in the other within a second.
- Add the **same** entity to the same collection in both windows. One member row,
  and sync stays healthy rather than wedging.
- Create a collection with the **same name** in both while one is offline
  (devtools → Network → Offline). They merge; no `(2)` suffix.
- Delete a collection in one window; it disappears from the other.
- Sign a fresh window in and confirm groups and members arrive intact.

Inspect the backend directly at http://127.0.0.1:54323 (Supabase Studio) or:

```bash
docker exec -i supabase_db_scrolled psql -U postgres -d postgres -c 'table sync_collections'
```

The pass condition is **one row per logical record**.

## Tests

```bash
nix develop -c pnpm --filter @scrolled/sync-testkit test
```

Drives the real `@scrolled/sync-supabase` adapter against the running stack —
upserts, cursor paging, the unique-name rejection that triggers a merge, RLS
isolation between accounts, and the realtime doorbell. Skipped automatically when
the stack is not running, so `pnpm test` stays green without Docker.

## Resetting

```bash
nix develop -c supabase db reset   # re-runs every migration on an empty database
nix develop -c supabase stop       # frees the containers
```

Clearing a window's local state is a browser-side job: devtools → Application →
Clear site data. The app's **Replace from account** button (Settings → Account &
Sync) rebuilds a device from the backend without clearing anything else.
