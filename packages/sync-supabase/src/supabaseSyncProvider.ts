// The Supabase sync transport (docs/sync_design.md §12, §16 Phase 3). It
// implements the provider-agnostic `SyncProvider` from `@scrolled/sync-core`
// over three Postgres RPCs — `sync_push`, `sync_pull`, `sync_hello` — reached
// with the signed-in user's bearer token. The functions are `security definer`
// and derive the account from `auth.uid()`, so the client never names a tenant
// (§14); this adapter just shuttles batches and maps errors onto the engine's
// error vocabulary. `subscribe` is a no-op until Phase 4 adds the Broadcast
// doorbell.
//
// This is the only sync package that imports the Supabase SDK. The app reaches
// it through a dynamic import behind a build constant, so self-hosted builds
// drop it entirely (mirrors `@scrolled/identity-cloud`).

import { createClient } from '@supabase/supabase-js';
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

const DEFAULT_PULL_PAGE_SIZE = 500;

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
  // the Supabase SDK exposes for "bring your own auth".
  const client: SyncRpcClient =
    config.client ??
    createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      accessToken: async () => (await config.getAccessToken()) ?? '',
    });

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

    // Phase 4 swaps this for a Supabase Realtime Broadcast subscription on the
    // per-account channel. Until then liveness comes from the engine's 60s
    // safety tick and the post-mutation debounce, so a no-op is correct.
    subscribe(_onPoke: () => void): Unsubscribe {
      return () => {};
    },

    async hello(): Promise<ProtocolHandshake> {
      const { data, error } = await client.rpc('sync_hello');
      if (error) throwMapped(error);
      return protocolHandshakeSchema.parse(data) satisfies ProtocolHandshake;
    },
  };
}

export { PROTOCOL_VERSION };
