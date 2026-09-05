-- Groups gain an optional description, mirrored from the local schema.
--
-- Additive and nullable, so it needs no protocol bump: an older client simply
-- never sends the column and reads it as null.

alter table public.sync_collection_groups
  add column if not exists description text;
