-- Change-log retention/GC + cursor-staleness signal (docs/sync_design.md §10, §15).
--
-- Deletes replicate as tombstone rows (op='delete') in sync_records so an
-- offline device learns of them on its next pull. We can't keep tombstones
-- forever, so `sync_gc` reaps tombstones older than the retention window and
-- records, per account, the highest server_seq it removed (`gc_horizon`). A
-- client whose cursor predates that horizon may have missed a now-GC'd delete,
-- so `sync_pull` tells it to re-bootstrap (pull from 0) rather than hand back a
-- delta that would silently keep a deleted row.

-- Per-account high-water mark of GC'd history. A cursor at or below this can no
-- longer be reconciled by a delta pull.
alter table public.sync_account_seq
  add column if not exists gc_horizon bigint not null default 0;

-- == sync_gc =================================================================
-- Reap delete-tombstones older than the retention window and advance each
-- affected account's gc_horizon. Returns the number of rows reaped. NOT granted
-- to clients — it is meant to run from a scheduled job (see the note below),
-- never on the request path. Upsert rows are current state and are never reaped.
create or replace function public.sync_gc(p_retention_days int default 90)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff  timestamptz := now() - make_interval(days => greatest(coalesce(p_retention_days, 90), 1));
  v_removed bigint;
begin
  with gone as (
    delete from public.sync_records
      where op = 'delete' and server_time < v_cutoff
      returning account_id, server_seq
  ),
  horizons as (
    select account_id, max(server_seq) as max_seq from gone group by account_id
  ),
  bumped as (
    -- Data-modifying CTEs always run to completion, so the horizon advances
    -- even though the final select only reads `gone`.
    update public.sync_account_seq s
       set gc_horizon = greatest(s.gc_horizon, h.max_seq)
       from horizons h
      where s.account_id = h.account_id
      returning 1
  )
  select count(*) into v_removed from gone;
  return v_removed;
end;
$$;

revoke all on function public.sync_gc(int) from public;

-- Scheduling: run daily via pg_cron once the extension is enabled, e.g.
--   select cron.schedule('sync-gc-daily', '17 3 * * *', $$select public.sync_gc(90)$$);
-- pg_cron runs as the table owner, so no extra grant is needed. Forks that don't
-- enable pg_cron can call sync_gc() from any owner-level scheduled job instead.

-- == sync_pull (replaced) ====================================================
-- Same delta pull as the base migration, with one addition: a cursor below the
-- account's gc_horizon can't be reconciled by a delta (it may have missed a
-- GC'd delete), so return the `rebootstrapRequired` signal and let the client
-- re-pull from 0. Cursor 0 is always a full bootstrap, so it is never stale.
create or replace function public.sync_pull(p_cursor bigint, p_limit int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account  uuid := (select auth.uid());
  v_limit    int  := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_horizon  bigint;
  v_changes  jsonb;
  v_next     bigint;
  v_has_more boolean;
begin
  if v_account is null then
    raise exception 'sync_pull requires authentication' using errcode = '28000';
  end if;

  select gc_horizon into v_horizon
    from public.sync_account_seq where account_id = v_account;

  if p_cursor > 0 and coalesce(v_horizon, 0) > 0 and p_cursor < v_horizon then
    return jsonb_build_object(
      'changes', '[]'::jsonb,
      'nextCursor', p_cursor,
      'hasMore', false,
      'rebootstrapRequired', true
    );
  end if;

  with page as (
    select entity, uuid, op, payload, revision, origin_device, server_seq
      from public.sync_records
      where account_id = v_account and server_seq > p_cursor
      order by server_seq
      limit v_limit
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'entity', entity,
          'uuid', uuid,
          'op', op,
          'payload', payload,
          'baseRevision', greatest(revision - 1, 0),
          'idempotency', 'server:' || server_seq::text,
          'revision', revision,
          'serverSeq', server_seq
        )
        order by server_seq
      ),
      '[]'::jsonb
    ),
    coalesce(max(server_seq), p_cursor)
    into v_changes, v_next
    from page;

  v_has_more := exists (
    select 1 from public.sync_records
      where account_id = v_account and server_seq > v_next
  );

  return jsonb_build_object('changes', v_changes, 'nextCursor', v_next, 'hasMore', v_has_more);
end;
$$;

-- The wire contract grew the `rebootstrapRequired` field, so the protocol
-- version moves to 2 (additive — old clients ignore it, min_client_revision
-- stays 1).
update public.sync_protocol
  set protocol_version = 2, min_client_revision = 1
  where id = 1;
