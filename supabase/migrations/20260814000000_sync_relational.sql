-- Sync backend: per-account tables mirroring the user DB's own schema.
--
-- Identity is the natural key, never a client-minted id, so two devices writing
-- the same logical record converge on one row instead of accumulating duplicates.
-- The server's constraints and the client's constraints are the same set, so
-- applying a pulled row can never violate a local constraint.
--
-- There is no server process: push is a PostgREST upsert, pull a select, and
-- tenancy is enforced by RLS rather than by application code. All merge and
-- reconcile logic lives client-side in @scrolled/sync-core.

-- `seq` is the per-row staleness comparator; `server_time` is the pull cursor.
-- They are separate because nextval is not transaction-ordered: a lower seq can
-- become visible after a higher one, so paging on seq could skip a row forever.
-- Clients page on server_time with an overlap window and rely on the apply being
-- an idempotent natural-key upsert.
create sequence if not exists public.sync_seq;

create or replace function public.sync_stamp_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.seq         := nextval('public.sync_seq');
  new.server_time := now();
  new.account_id  := coalesce(new.account_id, (select auth.uid()));
  return new;
end;
$$;

-- Liveness only; correctness comes from the cursor pull. The poke carries no row
-- data, just the writing device so a client can ignore its own echo.
create or replace function public.sync_poke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('device', new.origin_device),
    'poke',
    'sync:' || new.account_id::text,
    true
  );
  return null;
end;
$$;

-- Columns mirror the local SQLite tables, except that 0/1 integer booleans become
-- real booleans and `deleted_at` becomes a timestamptz so tombstone GC can
-- compare it to now(). `created_at`/`updated_at` stay epoch-ms client hints and
-- are never used as an integrity comparator.

-- `key` is client-minted so a collection can be created offline and referenced by
-- its members before the server has seen it. The unique name is the real identity
-- constraint: a rejected insert tells the client this record already exists under
-- another key, and it merges onto that one.
create table if not exists public.sync_collections (
  account_id      uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  key             text   not null,
  name            text   not null,
  description     text,
  color           text,
  icon            text,
  pinned          boolean not null default false,
  pinned_position int,
  grouping        text   not null default 'group',
  subgrouping     text   not null default 'type',
  sort_key        text   not null default 'manual',
  sort_dir        text   not null default 'asc',
  created_at      bigint not null,
  updated_at      bigint not null,
  origin_device   text   not null default '',
  deleted_at      timestamptz,
  seq             bigint not null,
  server_time     timestamptz not null,
  primary key (account_id, key)
);

-- Partial so a tombstone never reserves a name.
create unique index if not exists sync_collections_name_uniq
  on public.sync_collections (account_id, name)
  where deleted_at is null;

create index if not exists sync_collections_cursor_idx
  on public.sync_collections (account_id, server_time);

-- The foreign key is what makes orphaned children impossible: a group pushed
-- before its collection is rejected rather than silently dropped.
create table if not exists public.sync_collection_groups (
  account_id     uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  key            text   not null,
  collection_key text   not null,
  name           text   not null,
  position       int    not null default 0,
  created_at     bigint not null,
  updated_at     bigint not null,
  origin_device  text   not null default '',
  deleted_at     timestamptz,
  seq            bigint not null,
  server_time    timestamptz not null,
  primary key (account_id, key),
  foreign key (account_id, collection_key)
    references public.sync_collections (account_id, key) on delete cascade
);

create unique index if not exists sync_collection_groups_name_uniq
  on public.sync_collection_groups (account_id, collection_key, name)
  where deleted_at is null;

create index if not exists sync_collection_groups_cursor_idx
  on public.sync_collection_groups (account_id, server_time);

-- No minted id at all: two devices adding the same entity to the same collection
-- write the same row.
--
-- `group_key` deliberately has no foreign key. Deleting a group re-parents its
-- members client-side, and a briefly dangling key just renders as ungrouped —
-- cheaper than rejecting members that arrive before their group.
create table if not exists public.sync_collection_members (
  account_id     uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  collection_key text   not null,
  entity_type    text   not null check (entity_type in ('item','equip','mob','npc','map','quest')),
  entity_id      bigint not null,
  group_key      text,
  note           text,
  quantity       int,
  done           boolean not null default false,
  position       int    not null default 0,
  added_at       bigint not null,
  updated_at     bigint not null,
  origin_device  text   not null default '',
  deleted_at     timestamptz,
  seq            bigint not null,
  server_time    timestamptz not null,
  primary key (account_id, collection_key, entity_type, entity_id),
  foreign key (account_id, collection_key)
    references public.sync_collections (account_id, key) on delete cascade
);

create index if not exists sync_collection_members_cursor_idx
  on public.sync_collection_members (account_id, server_time);

create table if not exists public.sync_pinned_searches (
  account_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  key           text   not null,
  name          text   not null,
  entity        text   not null check (entity in ('item','equip','mob','npc','map','quest')),
  params_json   text   not null default '{}',
  created_at    bigint not null,
  updated_at    bigint not null,
  origin_device text   not null default '',
  deleted_at    timestamptz,
  seq           bigint not null,
  server_time   timestamptz not null,
  primary key (account_id, key)
);

create unique index if not exists sync_pinned_searches_name_uniq
  on public.sync_pinned_searches (account_id, name)
  where deleted_at is null;

create index if not exists sync_pinned_searches_cursor_idx
  on public.sync_pinned_searches (account_id, server_time);

create table if not exists public.sync_user_settings (
  account_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  key           text   not null,
  value         text   not null,
  updated_at    bigint not null,
  origin_device text   not null default '',
  deleted_at    timestamptz,
  seq           bigint not null,
  server_time   timestamptz not null,
  primary key (account_id, key)
);

create index if not exists sync_user_settings_cursor_idx
  on public.sync_user_settings (account_id, server_time);

-- `name` is a local display label resolved from the game DB, so it has no column
-- here — game-derived names never leave the device.
create table if not exists public.sync_recents (
  account_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text   not null check (kind in ('entity','query')),
  ref           text   not null,
  viewed_at     bigint not null,
  updated_at    bigint not null,
  origin_device text   not null default '',
  deleted_at    timestamptz,
  seq           bigint not null,
  server_time   timestamptz not null,
  primary key (account_id, kind, ref)
);

create index if not exists sync_recents_cursor_idx
  on public.sync_recents (account_id, server_time);

do $$
declare
  t text;
begin
  foreach t in array array[
    'sync_collections',
    'sync_collection_groups',
    'sync_collection_members',
    'sync_pinned_searches',
    'sync_user_settings',
    'sync_recents'
  ]
  loop
    execute format('drop trigger if exists %I_stamp on public.%I', t, t);
    execute format(
      'create trigger %I_stamp before insert or update on public.%I
         for each row execute function public.sync_stamp_row()', t, t);

    execute format('drop trigger if exists %I_poke on public.%I', t, t);
    execute format(
      'create trigger %I_poke after insert or update on public.%I
         for each row execute function public.sync_poke()', t, t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_own on public.%I', t, t);
    -- `with check` is what stops a client naming another account. Clients need
    -- DELETE because tombstone GC is client-driven; there is no cron to run it.
    execute format(
      'create policy %I_own on public.%I for all to authenticated
         using (account_id = (select auth.uid()))
         with check (account_id = (select auth.uid()))', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

update public.sync_protocol
   set protocol_version = 3,
       min_client_revision = 3
 where id = 1;
