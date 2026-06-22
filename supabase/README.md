# Supabase backend (hosted deployments only)

These migrations provision the server side of cross-device sync
(`docs/sync_design.md` §12). They are **only** needed by the canonical hosted
deployment — or any fork that opts into `VITE_SYNC_MODE=supabase`. Self-hosted
and generic builds never sync, ship zero Supabase code, and need nothing here.

`migrations/` holds plain SQL applied to a Supabase Postgres database. Apply it
with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

or paste the file into the project's SQL editor.

## What it creates

- `sync_records` — the append-only change log, one row per logical record,
  scoped per account.
- `sync_account_seq` — the monotonic per-account `server_seq` source.
- `sync_idempotency` — at-least-once push-retry dedup ledger.
- `sync_protocol` — a single row advertising the wire protocol version.
- `sync_push` / `sync_pull` / `sync_hello` — `security definer` RPC functions.
  The account is always derived from `auth.uid()`; the client never names a
  tenant.

Row Level Security is enabled on every table. The bookkeeping tables have no
client policy at all (only the functions, running as owner, reach them);
`sync_records` is readable for the owning account; `sync_protocol` is public.

Realtime Broadcast (the liveness doorbell) is **not** provisioned here — that is
a later phase (`docs/sync_design.md` §16 Phase 4). Until then the client stays
correct via cursor pulls on a safety tick.

Bump `sync_protocol.protocol_version` only alongside a `PROTOCOL_VERSION` bump in
`@scrolled/sync-core`; raise `min_client_revision` to lock out clients too old to
speak the current contract.
