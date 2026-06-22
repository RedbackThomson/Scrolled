-- Realtime doorbell for sync (docs/sync_design.md §12 "Realtime is a doorbell",
-- §16 Phase 4). Liveness only — correctness already comes from the cursor pulls
-- in 20260621000000_sync.sql. This adds sub-second cross-device propagation: a
-- trigger on sync_records pokes a private per-account Broadcast channel, and the
-- client responds by calling sync_pull over the already-RLS-scoped RPC.
--
-- Why Broadcast and not postgres_changes (§12): postgres_changes re-runs RLS per
-- subscriber on a single thread and does not apply RLS to DELETE events, leaking
-- deleted-row keys across tenants — fatal for a tombstone design. Broadcast on a
-- private channel scales and leaks nothing: the poke carries NO row data (just
-- the advanced seq), and channel subscription is gated by RLS on
-- realtime.messages so only the owning account can listen.

-- == Receive authorization ==================================================
-- A client may SELECT (receive) broadcast messages only on its own account's
-- channel, `sync:<account_id>`. realtime.topic() is the channel topic the client
-- is connecting to; we match it against the caller's own auth.uid(), so a guessed
-- channel name authorizes nothing. (No INSERT policy: messages are produced by
-- the trigger below running as owner, never by clients.)
drop policy if exists sync_broadcast_receive_own on realtime.messages;
create policy sync_broadcast_receive_own on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'sync:' || (select auth.uid())::text
  );

-- == The poke trigger =======================================================
-- Fires after every sync_records write (push appends one upsert/delete row per
-- change). realtime.send() inserts a Broadcast message that the replication slot
-- fans out to subscribers; it captures its own errors so a Realtime hiccup can
-- never break the push transaction. The payload is a bare seq — no payload/row
-- data crosses the wire; the client pulls the authoritative change over the RPC.
create or replace function public.sync_records_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('seq', NEW.server_seq),  -- poke only; not the record
    'poke',
    'sync:' || NEW.account_id::text,
    true                                        -- private channel
  );
  return null;
end;
$$;

drop trigger if exists sync_records_broadcast_trigger on public.sync_records;
create trigger sync_records_broadcast_trigger
  after insert or update on public.sync_records
  for each row
  execute function public.sync_records_broadcast();
