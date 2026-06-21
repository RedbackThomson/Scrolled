/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_COMMIT?: string;
  readonly VITE_ANALYTICS_PROVIDER?: string;
  readonly VITE_ANALYTICS_TOKEN?: string;
  readonly VITE_ANALYTICS_ALLOWED_HOSTS?: string;
  readonly VITE_DEPLOYMENT_PROFILE?: string;
  readonly VITE_DATASET_FAMILY?: string;
  readonly VITE_DATASET_CHANNEL?: string;
  readonly VITE_DATASET_REPO_URL?: string;
  readonly VITE_IDENTITY_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** @deprecated Supabase legacy key; prefer VITE_SUPABASE_PUBLISHABLE_KEY. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_OAUTH_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Build-time constant injected by `vite.config.ts` (`define`). It is the literal
 * `false` in any build not configured for cloud accounts, so the dynamic import
 * of `@scrolled/identity-cloud` behind it is dead code that Rollup drops — the
 * Supabase SDK never reaches a self-hosted bundle.
 */
declare const __IDENTITY_CLOUD__: boolean;
