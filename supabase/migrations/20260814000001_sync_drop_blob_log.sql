-- Retire the previous sync backend.
--
-- The stored data is dropped rather than migrated: clients hold it locally, and
-- re-pushing merges duplicates on arrival via the natural keys.
--
-- `sync_hello` and `sync_protocol` stay so a client on the old protocol gets a
-- clean "update required" instead of failing against tables it cannot read.

drop trigger if exists sync_records_broadcast_trigger on public.sync_records;
drop function if exists public.sync_records_broadcast();

drop function if exists public.sync_push(jsonb);
drop function if exists public.sync_pull(bigint, int);
drop function if exists public.sync_gc(int);

drop table if exists public.sync_records;
drop table if exists public.sync_idempotency;
drop table if exists public.sync_account_seq;
