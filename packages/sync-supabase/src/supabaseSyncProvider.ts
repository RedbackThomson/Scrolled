// The Supabase sync transport (docs/sync_design.md §12, §16 Phases 3–4). It
// implements the provider-agnostic `SyncProvider` from `@scrolled/sync-core`
// over three Postgres RPCs — `sync_push`, `sync_pull`, `sync_hello` — reached
// with the signed-in user's bearer token, plus a Realtime Broadcast doorbell
// (`subscribe`). The functions are `security definer` and derive the account
// from `auth.uid()`, so the client never names a tenant (§14); this adapter just
// shuttles batches, opens the per-account poke channel, and maps errors onto the
// engine's error vocabulary.
//
// This is the only sync package that imports the Supabase SDK. The app reaches
// it through a dynamic import behind a build constant, so self-hosted builds
// drop it entirely (mirrors `@scrolled/identity-cloud`).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  PROTOCOL_VERSION,
  pullResultSchema,
  pushResultSchema,
  protocolHandshakeSchema,
  SyncAuthError,
  SyncTransientError,
  type ProtocolHandshake,
  type PullResult,
  type PushResult,
  type SyncChange,
  type SyncProvider,
  type Unsubscribe,
} from '@scrolled/sync-core';

export interface SupabaseSyncConfig {
  supabaseUrl: string;
  /** Publishable client key (`sb_publishable_…`) or a legacy `anon` key. */
  supabaseKey: string;
  /** Bearer token thunk, sourced from the identity provider. */
  getAccessToken: () => Promise<string | null>;
  /**
   * Test seam: inject an RPC client instead of constructing a Supabase one.
   * Production leaves this unset and a real client is created.
   */
  client?: SyncRpcClient;
  /**
   * Test seam for the Broadcast doorbell. Production leaves it unset and the
   * channel methods are taken from the same real Supabase client; injecting
   * `client` (the RPC seam) suppresses real-client construction, so a subscribe
   * test that wants the doorbell injects this too.
   */
  realtime?: SyncRealtimeClient;
  /** Max rows per pull page; forwarded to `sync_pull` so the server paginates. */
  pullPageSize?: number;
}

interface SupabaseRpcError {
  message: string;
  code?: string;
  status?: number;
}

/** The slice of the Supabase client this adapter uses — just `rpc`. Narrowed to
 *  an interface so tests can drive push/pull/hello with a fake. */
export interface SyncRpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: SupabaseRpcError | null }>;
}

/** A subscribed Realtime channel — the slice the doorbell drives. */
export interface SyncRealtimeChannel {
  on(type: 'broadcast', filter: { event: string }, cb: () => void): SyncRealtimeChannel;
  subscribe(cb?: (status: string, err?: Error) => void): SyncRealtimeChannel;
}

/** The slice of the Supabase client the Broadcast doorbell uses. Narrowed so a
 *  test can drive subscribe/unsubscribe without a live WebSocket. */
export interface SyncRealtimeClient {
  /** Hand Realtime the current JWT so RLS on the private channel can authorize. */
  setAuth(token: string): void | Promise<void>;
  channel(topic: string, opts: { config: { private: boolean } }): SyncRealtimeChannel;
  removeChannel(channel: SyncRealtimeChannel): void | Promise<void>;
}

const DEFAULT_PULL_PAGE_SIZE = 500;

/** The Broadcast event the `sync_records` poke trigger emits (must match the
 *  `realtime.send(..., 'poke', ...)` call in the sync_realtime migration). */
const POKE_EVENT = 'poke';

/**
 * The per-account channel a client subscribes to. The server's RLS policy on
 * `realtime.messages` only authorizes `sync:<own auth.uid()>`, so this must be
 * derived from the same JWT the connection authenticates with — read the `sub`
 * claim. A bad guess authorizes nothing (and the poke carries no data anyway).
 */
function channelTopic(accountId: string): string {
  return `sync:${accountId}`;
}

/** Read the `sub` claim from a JWT without verifying it — RLS does the real
 *  enforcement server-side; we only need the topic name. Returns null on any
 *  malformed token, so the caller degrades to the safety tick. */
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

// PostgREST surfaces an expired/invalid JWT as a 401 with one of these codes;
// our `security definer` functions raise SQLSTATE 28000 when `auth.uid()` is
// null. Either means "re-authenticate", which the engine handles by refreshing
// the token once before surfacing "session expired".
const AUTH_ERROR_CODES = new Set(['PGRST301', 'PGRST302', '42501', '28000']);

function isAuthError(error: SupabaseRpcError): boolean {
  if (error.status === 401 || error.status === 403) return true;
  if (error.code && AUTH_ERROR_CODES.has(error.code)) return true;
  return /jwt|token|unauthor|not authenticated/i.test(error.message);
}

/** Map a PostgREST error onto the engine's error vocabulary: auth failures ask
 *  for a token refresh, everything else backs off as transient. */
function throwMapped(error: SupabaseRpcError): never {
  if (isAuthError(error)) throw new SyncAuthError();
  throw new SyncTransientError(error.message || 'sync request failed');
}

export function createSupabaseSyncProvider(config: SupabaseSyncConfig): SyncProvider {
  const pageSize = config.pullPageSize ?? DEFAULT_PULL_PAGE_SIZE;

  // A data-only client: identity-cloud owns the auth session, so this one never
  // persists or refreshes a session. The `accessToken` thunk hands PostgREST the
  // current bearer per request, which is exactly the third-party-auth contract
  // the Supabase SDK exposes for "bring your own auth". The same client backs
  // both the RPCs and the Realtime channel; we build it only when the RPC seam
  // is absent (production), so an RPC-only test never opens a real connection.
  const realClient = config.client
    ? null
    : createClient(config.supabaseUrl, config.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        accessToken: async () => (await config.getAccessToken()) ?? '',
      });
  const client: SyncRpcClient = config.client ?? realClient!;

  // The Broadcast doorbell drives channel/removeChannel and realtime.setAuth on
  // the same real client; the injected seam replaces it in tests. Null when only
  // the RPC seam was injected, so `subscribe` degrades to the engine's tick.
  const realtime: SyncRealtimeClient | null =
    config.realtime ?? (realClient ? toRealtimeClient(realClient) : null);

  /** Fail fast with a clean auth error when signed out, before a pointless trip. */
  async function requireToken(): Promise<void> {
    const token = await config.getAccessToken();
    if (!token) throw new SyncAuthError();
  }

  return {
    async push(changes: SyncChange[]): Promise<PushResult> {
      await requireToken();
      const { data, error } = await client.rpc('sync_push', { p_changes: changes });
      if (error) throwMapped(error);
      // Validate the envelope at this trust boundary (it came off the wire), then
      // return the contract type — record payloads stay `unknown` by design.
      pushResultSchema.parse(data);
      return data as PushResult;
    },

    async pull(cursor: number): Promise<PullResult> {
      await requireToken();
      const { data, error } = await client.rpc('sync_pull', {
        p_cursor: cursor,
        p_limit: pageSize,
      });
      if (error) throwMapped(error);
      pullResultSchema.parse(data);
      return data as PullResult;
    },

    // Open the private per-account Broadcast channel and ring `onPoke` on each
    // message; the engine responds with a pull. The poke carries no data, so a
    // missed message is harmless — the 60s safety tick (and the next push) close
    // any gap. Channel setup is async (token fetch + setAuth), so the returned
    // Unsubscribe guards against tearing down a channel that hasn't opened yet.
    subscribe(onPoke: () => void): Unsubscribe {
      if (!realtime) return () => {};
      let channel: SyncRealtimeChannel | null = null;
      let cancelled = false;

      void (async () => {
        const token = await config.getAccessToken();
        if (!token || cancelled) return;
        const accountId = decodeJwtSub(token);
        if (!accountId) return; // can't derive the topic; rely on the safety tick
        // Realtime authorizes the private channel from the JWT claims, so hand it
        // the current token before subscribing.
        await realtime.setAuth(token);
        if (cancelled) return;
        const ch = realtime.channel(channelTopic(accountId), { config: { private: true } });
        ch.on('broadcast', { event: POKE_EVENT }, () => onPoke());
        ch.subscribe();
        channel = ch;
      })();

      return () => {
        cancelled = true;
        if (channel) void realtime.removeChannel(channel);
      };
    },

    async hello(): Promise<ProtocolHandshake> {
      const { data, error } = await client.rpc('sync_hello');
      if (error) throwMapped(error);
      return protocolHandshakeSchema.parse(data) satisfies ProtocolHandshake;
    },
  };
}

/**
 * Adapt a real SupabaseClient to the narrowed `SyncRealtimeClient` slice. FFI
 * boundary: supabase-js types `channel`/`realtime.setAuth` more loosely than our
 * doorbell needs, so the casts pin them to the shape `subscribe` drives.
 */
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
