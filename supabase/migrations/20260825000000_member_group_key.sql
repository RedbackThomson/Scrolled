-- A collection member's identity gains its group.
--
-- Previously a member was keyed by (account, collection, entity), so an entity
-- could appear once per collection. The key now includes `group_key`, letting
-- the same entity live in more than one group of a collection — at most once
-- per group. The default (ungrouped) bucket is the empty string, not NULL, so
-- it can sit in the primary key alongside real group keys.
--
-- Protocol bumps to 4: a v3 client keys members without the group and would
-- collapse the new placements onto a single row, so older clients must update.

update public.sync_collection_members set group_key = '' where group_key is null;

alter table public.sync_collection_members
  alter column group_key set default '',
  alter column group_key set not null;

alter table public.sync_collection_members
  drop constraint sync_collection_members_pkey;

alter table public.sync_collection_members
  add primary key (account_id, collection_key, group_key, entity_type, entity_id);

-- The entity-type domain matched the six original kinds; quest chains and skills
-- became collectable since. Widen the check so those members are accepted.
alter table public.sync_collection_members
  drop constraint sync_collection_members_entity_type_check;

alter table public.sync_collection_members
  add constraint sync_collection_members_entity_type_check
  check (entity_type in ('item','equip','mob','npc','map','quest','questChain','skill'));

update public.sync_protocol
   set protocol_version = 4,
       min_client_revision = 4
 where id = 1;
