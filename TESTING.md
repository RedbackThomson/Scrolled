# Testing

How to run the checks, and what each layer is actually good for.

| Layer       | Command                                         | Needs  |
| ----------- | ----------------------------------------------- | ------ |
| Types       | `pnpm typecheck`                                | —      |
| Lint        | `pnpm lint`                                     | —      |
| Unit        | `pnpm test`                                     | —      |
| Integration | `pnpm test` (auto-skips)                        | Docker |
| Manual      | see [Two devices by hand](#two-devices-by-hand) | Docker |

All commands run inside the nix dev shell — prefix them with `nix develop -c`, or
open the shell once and drop the prefix.

```bash
nix develop -c pnpm typecheck && nix develop -c pnpm lint && nix develop -c pnpm test
```

## Unit tests

Vitest, colocated as `*.test.ts` beside the code. `pnpm test` runs every package;
narrow it while iterating:

```bash
nix develop -c pnpm --filter @scrolled/game-db test
nix develop -c pnpm --filter @scrolled/web exec vitest run src/db/user/queries/
```

Parser and extractor tests use **synthetic** raw-tree fixtures. Never commit game
files or anything derived from them, tests included.

## Integration tests

Everything above runs against fakes. The sync layer is the part where that is not
enough: it depends on how Postgres actually behaves — what its constraints reject,
how `now()` is scoped, what PostgREST accepts as a conflict target. A stand-in for
those inherits whatever the author assumed, so it agrees with the code precisely
where the code is wrong.

So the sync integration tests run against a **real local Supabase stack**: real
Postgres applying the migrations in `supabase/migrations/`, real PostgREST, real
GoTrue, real Realtime. The harness lives in [`tools/sync-testkit`](tools/sync-testkit).

### Setup

Needs a Docker daemon — Docker Desktop, OrbStack, colima, anything the Supabase
CLI can reach.

```bash
nix develop -c supabase start
```

The first run pulls a few GB of images and takes a while; later starts are quick.
It applies every migration, so a failure here is a broken migration.

### Running them

```bash
nix develop -c pnpm --filter @scrolled/sync-testkit test
```

They are also part of `pnpm test`, and **skip themselves when the stack is not
running**, so the suite stays green without Docker. That does mean a plain
`pnpm test` on a machine with no daemon is not covering sync end to end — start
the stack before trusting a green run on sync changes.

They drive the real `@scrolled/sync-supabase` adapter over HTTP and cover:

- upserts, and the `seq` Postgres stamps on each row
- the same record written by two devices collapsing to one row
- a unique-name rejection surfacing as a merge signal rather than a failure
- cursor paging without repeating or skipping rows
- tombstone reaping past the retention cutoff
- RLS keeping one account out of another's rows
- a member whose collection does not exist being rejected
- the realtime doorbell naming the writing device

### Two devices by hand

Convergence bugs only appear across devices, so some things are worth driving by
hand. Seed the accounts and point the app at the local stack:

```bash
nix develop -c pnpm supabase:seed
nix develop -c pnpm dev:supabase
```

`supabase:seed` creates the test accounts, writes `apps/web/.env.supabase`, and
prints a sign-in snippet.

Open the app **twice, on different origins** — `http://localhost:5173` and
`http://127.0.0.1:5173`. The browser scopes storage per origin, so each window
gets its own local database and device id. That is what makes them two devices
rather than two tabs. Paste the printed snippet into each window's console to
sign both into the same account.

Sign-in goes through the console because the app only offers OAuth, and a local
OAuth provider would have to be reachable at the same address from both the
browser and the GoTrue container — which means a machine-specific address in
committed config. `signInWithPassword` against real GoTrue avoids that and needs
no change to the app.

Worth exercising, since each of these was broken before the sync rework:

- Create a collection in one window; it should appear in the other in well under
  a second.
- Add the **same** entity to the same collection in both. One member row, and
  sync stays healthy rather than stalling on "offline".
- Take one window offline (devtools → Network → Offline), create a collection
  with the **same name** in both, then reconnect. They merge; no `(2)` suffix.
- Delete a collection that has groups and members; it disappears from the other
  window, leaves no orphans, and pending changes return to zero.
- Sign a fresh window in and confirm groups and members arrive intact.

Inspect the backend at http://127.0.0.1:54323 (Supabase Studio) or directly:

```bash
docker exec -i supabase_db_scrolled psql -U postgres -d postgres -c 'table sync_collections'
```

The pass condition is **one row per logical record**.

### Resetting

```bash
nix develop -c supabase db reset   # re-run every migration on an empty database
nix develop -c supabase stop       # free the containers
```

Clearing a window's local state is a browser job: devtools → Application → Clear
site data. To rebuild one device from the backend without touching anything else,
use **Replace from account** in Settings → Account & Sync.

## Writing tests

- Colocate as `*.test.ts`; name the behaviour, not the function.
- Prefer a test that fails for one reason. A test asserting a spy was called
  usually is not one.
- Reach for the integration layer when the thing under test is a belief about
  another system's behaviour, and for a unit test otherwise.
