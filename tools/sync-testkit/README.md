# sync-testkit

Runs the app and its sync integration tests against a **local Supabase stack** —
real Postgres applying the migrations in `supabase/`, real PostgREST, real GoTrue,
real Realtime.

Not published; repo-internal tooling, which is why it lives in `tools/` rather
than `packages/`.

Setup, commands, and the manual two-device walkthrough are in
[TESTING.md](../../TESTING.md). The short version:

```bash
nix develop -c supabase start
nix develop -c pnpm supabase:seed
nix develop -c pnpm --filter @scrolled/sync-testkit test
```

## What's in here

| File                      | Role                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `src/localSupabase.ts`    | Reads the running stack's URL and keys from the CLI            |
| `src/accounts.ts`         | Seeds test accounts, mints tokens, wipes an account's rows     |
| `src/cli.ts`              | `pnpm supabase:seed` — seeds accounts and writes the app's env |
| `src/integration.test.ts` | The real sync adapter against the real backend                 |
