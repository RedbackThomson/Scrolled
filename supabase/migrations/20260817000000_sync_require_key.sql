-- Refuse records with no key.
--
-- An empty key is not an identity: every keyless row matches every other, so
-- clients coalesce them onto one record and silently drop the rest. Rejecting
-- them here turns that into a loud failure at the point of the write rather than
-- data quietly going missing.
--
-- Existing keyless rows are deleted rather than repaired. A key minted here
-- would not match the one any client holds, so the row would come back as a
-- duplicate; clients still hold the real records and re-push them.

delete from public.sync_collection_members where collection_key = '';
delete from public.sync_collection_groups where key = '' or collection_key = '';
delete from public.sync_collections where key = '';
delete from public.sync_pinned_searches where key = '';
delete from public.sync_user_settings where key = '';
delete from public.sync_recents where kind = '' or ref = '';

alter table public.sync_collections
  add constraint sync_collections_key_present check (key <> '');

alter table public.sync_collection_groups
  add constraint sync_collection_groups_key_present check (key <> '' and collection_key <> '');

alter table public.sync_collection_members
  add constraint sync_collection_members_key_present check (collection_key <> '');

alter table public.sync_pinned_searches
  add constraint sync_pinned_searches_key_present check (key <> '');

alter table public.sync_user_settings
  add constraint sync_user_settings_key_present check (key <> '');

alter table public.sync_recents
  add constraint sync_recents_key_present check (kind <> '' and ref <> '');
