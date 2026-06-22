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
      redirectTo: oauthRedirectTo(),
    });
  }
  return createAnonymousProvider();
}

/**
 * The absolute URL Supabase returns to after OAuth. Derived from the
 * deployment's configured site URL (`VITE_SITE_URL`, the same canonical origin
 * used for SEO) so it's a single, stable value the operator can add to the
 * Supabase Redirect URLs allow list — Supabase ignores a `redirectTo` that
 * isn't allow-listed and silently falls back to its default Site URL. Falls back
 * to the runtime origin + base path for local dev, where no site URL is set.
 */
function oauthRedirectTo(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/+$/, '');
  const base =
    configured || `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, '');
  return `${base}/auth/callback`;
}
