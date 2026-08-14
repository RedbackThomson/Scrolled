// The Supabase transport. It implements the provider-agnostic `SyncProvider`
// over plain PostgREST table operations — no RPCs and no server-side logic, so
// the backend is a database rather than a service.
//
// Tenancy is enforced by row-level security on every table, which is why this
// adapter never names an account: `account_id` defaults to the caller's own id
// and RLS refuses anything else.
//
// This is the only sync package importing the Supabase SDK. The app reaches it
// through a dynamic import behind a build constant, so self-hosted builds drop it
// entirely.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ENTITY_KEY_COLUMNS,
  ENTITY_TABLE,
  PROTOCOL_VERSION,
  recordKey,
  SYNC_ENTITIES,
  SyncAuthError,
  SyncTransientError,
  type FetchPage,
  type ProtocolHandshake,
  type RemoteRow,
  type SyncEntity,
  type SyncProvider,
  type TaggedRow,
  type Unsubscribe,
  type UpsertResult,
} from '@scrolled/sync-core';

export interface SupabaseSyncConfig {
  supabaseUrl: string;
  /** Publishable client key (`sb_publishable_…`) or a legacy `anon` key. */
  supabaseKey: string;
  /** Bearer token thunk, sourced from the identity provider. */
  getAccessToken: () => Promise<string | null>;
  /** Test seam: inject a REST client instead of constructing a Supabase one. */
  rest?: SyncRestClient;
  /** Test seam for the doorbell; injecting `rest` alone suppresses the real
   *  client, so a subscribe test needs this too. */
  realtime?: SyncRealtimeClient;
  /** Rows per page. Must stay under the project's PostgREST `max_rows`. */
  pageSize?: number;
}

/** A unique-constraint rejection, distinguished from a genuine failure because
 *  it means the record already exists under another key. */
export class UniqueViolation extends Error {
  constructor(readonly constraint: string) {
    super(`unique constraint ${constraint}`);
    this.name = 'UniqueViolation';
  }
}

/** The table operations this adapter needs, narrowed so tests can drive it
 *  without a live PostgREST. */
export interface SyncRestClient {
  upsert(table: string, rows: RemoteRow[], onConflict: string): Promise<RemoteRow[]>;
  selectSince(
    table: string,
    cursor: string | null,
    limit: number,
    offset: number,
  ): Promise<RemoteRow[]>;
  selectOne(table: string, where: RemoteRow): Promise<RemoteRow | null>;
  deleteTombstones(table: string, before: string): Promise<void>;
  protocol(): Promise<{ protocol_version: number; min_client_revision: number }>;
}

export interface SyncRealtimeChannel {
  on(
    type: 'broadcast',
    filter: { event: string },
    cb: (message: { payload?: { device?: string } }) => void,
  ): SyncRealtimeChannel;
  subscribe(cb?: (status: string, err?: Error) => void): SyncRealtimeChannel;
}

export interface SyncRealtimeClient {
  /** Realtime authorizes the private channel from the JWT claims. */
  setAuth(token: string): void | Promise<void>;
  channel(topic: string, opts: { config: { private: boolean } }): SyncRealtimeChannel;
  removeChannel(channel: SyncRealtimeChannel): void | Promise<void>;
}

const DEFAULT_PAGE_SIZE = 500;
const POKE_EVENT = 'poke';

/** RLS only authorizes `sync:<own auth.uid()>`, so the topic must come from the
 *  same token the connection authenticates with. */
function channelTopic(accountId: string): string {
  return `sync:${accountId}`;
}

/** Read the `sub` claim without verifying it — RLS does the real enforcement and
 *  we only need the topic name. Null on a malformed token, so the caller falls
 *  back to the engine's periodic tick. */
function decodeJwtSub(token: string): string | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = typeof atob === 'function' ? atob(padded) : '';
    const claims = JSON.parse(json) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
  } catch {
    return null;
  }
}

export function createSupabaseSyncProvider(config: SupabaseSyncConfig): SyncProvider {
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;

  // A data-only client: identity-cloud owns the auth session, so this one never
  // persists or refreshes one and just hands PostgREST the current bearer.
  const realClient = config.rest
    ? null
    : createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        accessToken: async () => (await config.getAccessToken()) ?? '',
      });
  const rest: SyncRestClient = config.rest ?? toRestClient(realClient!);
  const realtime: SyncRealtimeClient | null =
    config.realtime ?? (realClient ? toRealtimeClient(realClient) : null);

  async function requireToken(): Promise<void> {
    if (!(await config.getAccessToken())) throw new SyncAuthError();
  }

  async function upsertBatch(entity: SyncEntity, rows: RemoteRow[]): Promise<UpsertResult['applied']> {
    const returned = await rest.upsert(
      ENTITY_TABLE[entity],
      rows,
      ENTITY_KEY_COLUMNS[entity].join(','),
    );
    return returned.map((row) => ({ key: recordKey(entity, row), seq: Number(row.seq ?? 0) }));
  }

  return {
    async upsert(entity, rows): Promise<UpsertResult> {
      await requireToken();
      if (rows.length === 0) return { applied: [], nameCollisions: [] };

      try {
        return { applied: await upsertBatch(entity, rows), nameCollisions: [] };
      } catch (err) {
        if (!(err instanceof UniqueViolation)) throw err;
      }

      // A rejection fails the whole statement, so isolate the offending rows.
      // Collisions are rare, which is why this slow path is acceptable.
      const applied: UpsertResult['applied'] = [];
      const nameCollisions: UpsertResult['nameCollisions'] = [];
      for (const row of rows) {
        try {
          applied.push(...(await upsertBatch(entity, [row])));
        } catch (err) {
          if (!(err instanceof UniqueViolation)) throw err;
          nameCollisions.push({ key: recordKey(entity, row), entity, row });
        }
      }
      return { applied, nameCollisions };
    },

    async fetchSince(cursor): Promise<FetchPage> {
      await requireToken();

      // Each table contributes at most a page. Because a table that returns a
      // full page has a maximum at or beyond the merged cut-off, truncating the
      // merged list can never strand a row behind the advancing cursor.
      let anyFull = false;
      const tagged: TaggedRow[] = [];
      for (const entity of SYNC_ENTITIES) {
        const rows = await rest.selectSince(ENTITY_TABLE[entity], cursor, pageSize, 0);
        if (rows.length >= pageSize) anyFull = true;
        for (const row of rows) tagged.push(toTagged(entity, row));
      }

      tagged.sort((a, b) => (a.serverTime < b.serverTime ? -1 : a.serverTime > b.serverTime ? 1 : 0));
      const truncated = tagged.length > pageSize;
      const page = truncated ? tagged.slice(0, pageSize) : tagged;
      const next = page.length > 0 ? page[page.length - 1].serverTime : (cursor ?? '');
      return { rows: page, cursor: next, complete: !truncated && !anyFull };
    },

    async fetchAll(): Promise<TaggedRow[]> {
      await requireToken();
      const out: TaggedRow[] = [];
      for (const entity of SYNC_ENTITIES) {
        for (let offset = 0; ; offset += pageSize) {
          const rows = await rest.selectSince(ENTITY_TABLE[entity], null, pageSize, offset);
          for (const row of rows) out.push(toTagged(entity, row));
          if (rows.length < pageSize) break;
        }
      }
      return out;
    },

    async findByUnique(entity, where): Promise<RemoteRow | null> {
      await requireToken();
      return rest.selectOne(ENTITY_TABLE[entity], where);
    },

    async gcTombstones(before): Promise<void> {
      await requireToken();
      for (const entity of SYNC_ENTITIES) {
        await rest.deleteTombstones(ENTITY_TABLE[entity], before);
      }
    },

    // The poke carries no row data, so a missed message costs only latency; the
    // engine's periodic tick and the next push close any gap.
    subscribe(onPoke): Unsubscribe {
      if (!realtime) return () => {};
      let channel: SyncRealtimeChannel | null = null;
      let cancelled = false;

      void (async () => {
        const token = await config.getAccessToken();
        if (!token || cancelled) return;
        const accountId = decodeJwtSub(token);
        if (!accountId) return;
        await realtime.setAuth(token);
        if (cancelled) return;
        const ch = realtime.channel(channelTopic(accountId), { config: { private: true } });
        ch.on('broadcast', { event: POKE_EVENT }, (message) => onPoke(message.payload?.device ?? ''));
        ch.subscribe();
        if (cancelled) {
          void realtime.removeChannel(ch);
          return;
        }
        channel = ch;
      })();

      return () => {
        cancelled = true;
        if (channel) void realtime.removeChannel(channel);
      };
    },

    async hello(): Promise<ProtocolHandshake> {
      const row = await rest.protocol();
      return {
        protocolVersion: row.protocol_version,
        minClientRevision: row.min_client_revision,
      };
    },
  };
}

function toTagged(entity: SyncEntity, row: RemoteRow): TaggedRow {
  return {
    entity,
    row,
    seq: Number(row.seq ?? 0),
    serverTime: String(row.server_time ?? ''),
  };
}

interface PostgrestError {
  message: string;
  code?: string;
  details?: string;
  status?: number;
}

// PostgREST surfaces an expired or invalid JWT as a 401 with one of these codes.
const AUTH_ERROR_CODES = new Set(['PGRST301', 'PGRST302', '42501', '28000']);

function isAuthError(error: PostgrestError): boolean {
  if (error.status === 401 || error.status === 403) return true;
  if (error.code && AUTH_ERROR_CODES.has(error.code)) return true;
  return /jwt|token|unauthor|not authenticated/i.test(error.message);
}

function throwMapped(error: PostgrestError): never {
  if (error.code === '23505') {
    throw new UniqueViolation(error.details ?? error.message);
  }
  if (isAuthError(error)) throw new SyncAuthError();
  throw new SyncTransientError(error.message || 'sync request failed');
}

/**
 * Adapt a real SupabaseClient to the narrowed client this adapter drives. FFI
 * boundary: the SDK's builders are typed against a generated database schema we
 * do not generate, so the casts pin them to the shapes used here.
 */
function toRestClient(supabase: SupabaseClient): SyncRestClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped schema
  const from = (table: string) => supabase.from(table) as any;

  return {
    async upsert(table, rows, onConflict) {
      const { data, error } = await from(table).upsert(rows, { onConflict }).select();
      if (error) throwMapped(error as PostgrestError);
      return (data ?? []) as RemoteRow[];
    },

    async selectSince(table, cursor, limit, offset) {
      let query = from(table).select('*').order('server_time').range(offset, offset + limit - 1);
      if (cursor) query = query.gt('server_time', cursor);
      const { data, error } = await query;
      if (error) throwMapped(error as PostgrestError);
      return (data ?? []) as RemoteRow[];
    },

    async selectOne(table, where) {
      const { data, error } = await from(table)
        .select('*')
        .match(where)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) throwMapped(error as PostgrestError);
      return (data ?? null) as RemoteRow | null;
    },

    async deleteTombstones(table, before) {
      const { error } = await from(table).delete().lt('deleted_at', before);
      if (error) throwMapped(error as PostgrestError);
    },

    async protocol() {
      const { data, error } = await from('sync_protocol')
        .select('protocol_version, min_client_revision')
        .eq('id', 1)
        .single();
      if (error) throwMapped(error as PostgrestError);
      return data as { protocol_version: number; min_client_revision: number };
    },
  };
}

function toRealtimeClient(supabase: SupabaseClient): SyncRealtimeClient {
  return {
    setAuth: (token) => {
      void supabase.realtime.setAuth(token);
    },
    channel: (topic, opts) => supabase.channel(topic, opts) as unknown as SyncRealtimeChannel,
    removeChannel: (ch) => {
      void supabase.removeChannel(ch as never);
    },
  };
}

export { PROTOCOL_VERSION };
