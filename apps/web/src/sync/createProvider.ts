import { appConfig } from '@/config';
import type { IdentityProvider } from '@scrolled/identity-core';
import type { SyncProvider } from '@scrolled/sync-core';

/**
 * Choose the sync transport for this deployment, or null when sync is off. The
 * branch is gated on `__SYNC_SUPABASE__`, a build-time literal
 * (`vite.config.ts` `define`): in any build not configured for Supabase sync it
 * is `false`, so the `import('@scrolled/sync-supabase')` below is statically
 * dead and Rollup drops it — the Supabase SDK never enters the bundle. This is
 * the one sanctioned place allowed to touch the sync transport (see eslint
 * config + docs/data_boundaries.md §5).
 *
 * Auth is injected: the adapter is constructed with the identity provider's
 * `getAccessToken` thunk, and reuses the cloud identity's Supabase project
 * (resolveSync guarantees `identity.mode === 'cloud'` whenever sync is on).
 */
export async function createSyncProvider(
  identity: IdentityProvider,
): Promise<SyncProvider | null> {
  const { sync, identity: identityConfig } = appConfig;
  if (
    __SYNC_SUPABASE__ &&
    sync.mode === 'supabase' &&
    identityConfig.mode === 'cloud' &&
    identityConfig.cloud
  ) {
    const { createSupabaseSyncProvider } = await import('@scrolled/sync-supabase');
    return createSupabaseSyncProvider({
      supabaseUrl: identityConfig.cloud.supabaseUrl,
      supabaseKey: identityConfig.cloud.supabaseKey,
      getAccessToken: () => identity.getAccessToken(),
    });
  }
  return null;
}
