import { appConfig } from '@/config';
import { createAnonymousProvider, type IdentityProvider } from '@scrolled/identity-core';

/**
 * Choose the identity provider for this deployment. The branch is gated on
 * `__IDENTITY_CLOUD__`, a build-time literal (`vite.config.ts` `define`): in any
 * build not configured for cloud accounts it is `false`, so the
 * `import('@scrolled/identity-cloud')` below is statically dead and Rollup drops
 * it — the Supabase SDK never enters the bundle. This is the one sanctioned
 * place allowed to touch the cloud provider (see eslint config).
 */
export async function createIdentityProvider(): Promise<IdentityProvider> {
  const { identity } = appConfig;
  if (__IDENTITY_CLOUD__ && identity.mode === 'cloud' && identity.cloud) {
    const { createSupabaseIdentityProvider } = await import('@scrolled/identity-cloud');
    return createSupabaseIdentityProvider({
      supabaseUrl: identity.cloud.supabaseUrl,
      supabaseKey: identity.cloud.supabaseKey,
      defaultProvider: identity.cloud.oauthProviders[0],
    });
  }
  return createAnonymousProvider();
}
