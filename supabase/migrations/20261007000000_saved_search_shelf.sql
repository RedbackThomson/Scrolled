-- Saved searches gain an icon, colour, shelf position and a pin to Home,
-- mirrored from the local schema, and may belong to any list page.
--
-- Additive and nullable, so it needs no protocol bump: an older client never
-- sends the new columns and reads them as null; clients treat a null pin as
-- pinned, which is how every saved search behaved before.

alter table public.sync_pinned_searches
  add column if not exists icon text,
  add column if not exists color text,
  add column if not exists position integer,
  add column if not exists pinned boolean;

alter table public.sync_pinned_searches
  drop constraint if exists sync_pinned_searches_entity_check;

alter table public.sync_pinned_searches
  add constraint sync_pinned_searches_entity_check
  check (entity in ('item','equip','weapon','mob','npc','map','quest','questChain','skill'));
