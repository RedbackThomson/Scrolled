-- Sync backend schema + RPCs (docs/sync_design.md §12, §14).
--
-- Mirrors the user DB's append-only change log on the server, scoped per
-- account. The write/read path is two `security definer` functions, never
-- direct table DML, because the server must atomically: derive the tenant from
-- `auth.uid()` (NEVER from client input — the defense against tenant spoofing),
-- check `base_revision` (409 on mismatch), assign `revision` + a per-account
-- monotonic `server_seq`, dedup on the idempotency key, and append the change.
-- RLS is on every table; the functions run as owner so they can touch the
-- bookkeeping tables clients are otherwise locked out of.

-- One row per logical user-owned record: its current state, scoped by account.
create table if not exists public.sync_records (
  account_id    uuid   not null,
  entity        text   not null,
  uuid          text   not null,
  op            text   not null check (op in ('upsert', 'delete')),
  payload       jsonb  not null,
  revision      int    not null,
  origin_device text   not null,
  updated_at    bigint not null,                 -- client hint, stored not trusted
  server_seq    bigint not null,                 -- assigned here; total order per account
  server_time   timestamptz not null default now(),
  primary key (account_id, entity, uuid)
);
create index if not exists sync_records_account_seq_idx
  on public.sync_records (account_id, server_seq);

-- Monotonic per-account sequence source for `server_seq`.
create table if not exists public.sync_account_seq (
  account_id uuid   primary key,
  last_seq   bigint not null default 0
);

-- Idempotency ledger so an at-least-once push retry replays its first outcome
-- instead of double-applying (Stripe-style).
create table if not exists public.sync_idempotency (
  account_id uuid not null,
  key        text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  primary key (account_id, key)
);

-- Single-row protocol advertisement, read by the client's `hello()` handshake.
create table if not exists public.sync_protocol (
  id                  int primary key default 1 check (id = 1),
  protocol_version    int not null,
  min_client_revision int not null
);
insert into public.sync_protocol (id, protocol_version, min_client_revision)
  values (1, 1, 1)
  on conflict (id) do update
    set protocol_version = excluded.protocol_version,
        min_client_revision = excluded.min_client_revision;

-- == Row Level Security =====================================================
-- Every table has RLS on. `sync_account_seq` and `sync_idempotency` get NO
-- policy at all, so clients cannot touch them directly — only the SECURITY
-- DEFINER functions (running as owner) can. `sync_records` is readable only for
-- the owning account as defense-in-depth (the pull function already scopes by
-- `auth.uid()`), and writable only through `sync_push`. `sync_protocol` is
-- public, non-sensitive metadata.

alter table public.sync_records enable row level security;
alter table public.sync_account_seq enable row level security;
alter table public.sync_idempotency enable row level security;
alter table public.sync_protocol enable row level security;

drop policy if exists sync_records_select_own on public.sync_records;
create policy sync_records_select_own on public.sync_records
  for select to authenticated
  using (account_id = (select auth.uid()));

drop policy if exists sync_protocol_read on public.sync_protocol;
create policy sync_protocol_read on public.sync_protocol
  for select to anon, authenticated
  using (true);

-- == sync_push ===============================================================
-- Apply a batch with optimistic-concurrency revision checks + idempotency
-- dedup. Returns { applied: [{uuid,revision,serverSeq}], conflicts:
-- [{uuid, remote}] } — camelCase keys so the JSON maps straight onto the
-- sync-core PushResult with no client-side remapping.
create or replace function public.sync_push(p_changes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account  uuid := (select auth.uid());
  v_change   jsonb;
  v_entity   text;
  v_uuid     text;
  v_op       text;
  v_payload  jsonb;
  v_base     int;
  v_idem     text;
  v_origin   text;
  v_updated  bigint;
  v_current  public.sync_records%rowtype;
  v_cached   jsonb;
  v_seq      bigint;
  v_new_rev  int;
  v_outcome  jsonb;
  v_applied  jsonb := '[]'::jsonb;
  v_conflicts jsonb := '[]'::jsonb;
begin
  if v_account is null then
    raise exception 'sync_push requires authentication' using errcode = '28000';
  end if;

  insert into public.sync_account_seq (account_id)
    values (v_account)
    on conflict (account_id) do nothing;

  for v_change in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb))
  loop
    v_entity  := v_change ->> 'entity';
    v_uuid    := v_change ->> 'uuid';
    v_op      := v_change ->> 'op';
    v_payload := v_change -> 'payload';
    v_base    := coalesce((v_change ->> 'baseRevision')::int, 0);
    v_idem    := v_change ->> 'idempotency';
    v_origin  := coalesce(v_payload ->> 'origin_device', '');
    v_updated := coalesce((v_payload ->> 'updated_at')::bigint, 0);

    -- At-least-once retry: replay the recorded outcome, do not re-apply.
    select result into v_cached
      from public.sync_idempotency
      where account_id = v_account and key = v_idem;
    if found then
      v_applied := v_applied || v_cached;
      continue;
    end if;

    select * into v_current
      from public.sync_records
      where account_id = v_account and entity = v_entity and uuid = v_uuid;

    -- Optimistic concurrency: accept only if the client based its edit on the
    -- revision the server still holds; otherwise report the conflict with the
    -- server's current record so the client can resolve + re-push.
    if coalesce(v_current.revision, 0) <> v_base then
      if found then
        v_conflicts := v_conflicts || jsonb_build_object(
          'uuid', v_uuid,
          'remote', jsonb_build_object(
            'entity', v_current.entity,
            'uuid', v_current.uuid,
            'op', v_current.op,
            'payload', v_current.payload,
            'baseRevision', 0,
            'idempotency', v_idem,
            'revision', v_current.revision
          )
        );
      else
        -- The client thinks a record exists that the server has never seen;
        -- report a synthetic deleted remote at revision 0.
        v_conflicts := v_conflicts || jsonb_build_object(
          'uuid', v_uuid,
          'remote', jsonb_build_object(
            'entity', v_entity,
            'uuid', v_uuid,
            'op', 'delete',
            'payload', v_payload,
            'baseRevision', 0,
            'idempotency', v_idem,
            'revision', 0
          )
        );
      end if;
      continue;
    end if;

    update public.sync_account_seq
      set last_seq = last_seq + 1
      where account_id = v_account
      returning last_seq into v_seq;
    v_new_rev := v_base + 1;

    insert into public.sync_records
        (account_id, entity, uuid, op, payload, revision, origin_device, updated_at, server_seq)
      values
        (v_account, v_entity, v_uuid, v_op, v_payload, v_new_rev, v_origin, v_updated, v_seq)
      on conflict (account_id, entity, uuid) do update
        set op = excluded.op,
            payload = excluded.payload,
            revision = excluded.revision,
            origin_device = excluded.origin_device,
            updated_at = excluded.updated_at,
            server_seq = excluded.server_seq,
            server_time = now();

    v_outcome := jsonb_build_object('uuid', v_uuid, 'revision', v_new_rev, 'serverSeq', v_seq);
    insert into public.sync_idempotency (account_id, key, result)
      values (v_account, v_idem, v_outcome);
    v_applied := v_applied || v_outcome;
  end loop;

  return jsonb_build_object('applied', v_applied, 'conflicts', v_conflicts);
end;
$$;

-- == sync_pull ===============================================================
-- Return this account's changes after `p_cursor`, ordered by `server_seq`,
-- paginated to `p_limit`. Each change is shaped as a sync-core ServerChange;
-- `baseRevision`/`idempotency` are synthesized (a server record has no pending
-- base) only so the value satisfies the wire schema — the apply path ignores
-- them.
create or replace function public.sync_pull(p_cursor bigint, p_limit int default 500)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account  uuid := (select auth.uid());
  v_limit    int  := least(greatest(coalesce(p_limit, 500), 1), 1000);
  v_changes  jsonb;
  v_next     bigint;
  v_has_more boolean;
begin
  if v_account is null then
    raise exception 'sync_pull requires authentication' using errcode = '28000';
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

-- == sync_hello ==============================================================
-- Protocol handshake; callable unauthenticated so an incompatible client learns
-- to upgrade rather than failing opaquely.
create or replace function public.sync_hello()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'protocolVersion', protocol_version,
    'minClientRevision', min_client_revision
  )
  from public.sync_protocol
  where id = 1;
$$;

revoke all on function public.sync_push(jsonb) from public;
revoke all on function public.sync_pull(bigint, int) from public;
revoke all on function public.sync_hello() from public;
grant execute on function public.sync_push(jsonb) to authenticated;
grant execute on function public.sync_pull(bigint, int) to authenticated;
grant execute on function public.sync_hello() to anon, authenticated;
