// Deployment configuration resolved at build time from environment variables.
//
// One codebase produces two kinds of deployment:
//   - "generic": the user brings their own game files and the browser builds
//     the library (the original behavior; the default when no env is set).
//   - "fixed-hosted-dataset": the site ships a prebuilt dataset downloaded from
//     a static repository; there is no import flow.
//
// This package is intentionally framework-agnostic: it reads a plain env record
// passed in by the caller, so it can be unit-tested without Vite. The app calls
// `resolveAppConfig(import.meta.env)` once at startup.

export type DeploymentProfile = 'generic' | 'fixed-hosted-dataset';

export interface DeploymentFeatureFlags {
  /** The user can import game files and (re)build the library themselves. */
  enableUserImport: boolean;
  /** The app installs a prebuilt dataset from a hosted repository. */
  enableHostedDataset: boolean;
  /** Sign-in and the auth callback route are reachable. */
  enableAccounts: boolean;
  /** The account avatar/menu and the Account settings section are shown. */
  accountMenu: boolean;
  /** Cross-device sync is active; sync status UI may be shown. */
  sync: boolean;
}

export interface FixedDatasetConfig {
  /** Dataset family to install, e.g. the slug a repository organizes versions under. */
  family: string;
  /** Channel that resolves to a concrete immutable version, e.g. "latest". */
  channel: string;
  /** Base URL of the static dataset repository (no trailing slash). */
  repositoryBaseUrl: string;
}

/**
 * How the deployment authenticates users. `anonymous` is the open-source
 * baseline — no accounts, no auth SDK in the bundle. `cloud` opts the canonical
 * hosted deployment into Supabase-backed accounts; its config carries the
 * Supabase project URL and publishable key, baked in at build time.
 */
export type IdentityMode = 'anonymous' | 'cloud';

export interface CloudIdentityConfig {
  supabaseUrl: string;
  /**
   * The Supabase publishable client key (`sb_publishable_…`). Supabase is
   * retiring the legacy JWT `anon` key in favour of this; both carry the same
   * low privileges and slot into the same `createClient(url, key)` position, so
   * a legacy `anon` key is still accepted. Public by design — guarded by Row
   * Level Security, not by secrecy — so it's safe to bake into the bundle.
   */
  supabaseKey: string;
  /**
   * OAuth provider ids the sign-in screen offers (e.g. `['google', 'github']`).
   * These must also be enabled in the Supabase project. Kept generic so the core
   * sign-in UI iterates the list without knowing any provider specifics.
   */
  oauthProviders: string[];
}

export interface IdentityConfig {
  mode: IdentityMode;
  /** Present only for the cloud mode. */
  cloud?: CloudIdentityConfig;
}

/**
 * How (and whether) the deployment syncs user data across devices. `off` is the
 * open-source baseline — no sync code is reachable and no transport SDK enters
 * the bundle. `supabase` opts the canonical hosted deployment into the Supabase
 * sync transport; it reuses the cloud identity's Supabase project, so it is only
 * valid when identity is `cloud` (no account ⇒ nothing to scope synced data to).
 */
export type SyncMode = 'off' | 'supabase';

export interface SyncConfig {
  mode: SyncMode;
}

export interface AppConfig {
  deploymentProfile: DeploymentProfile;
  features: DeploymentFeatureFlags;
  /** Present only for the fixed-hosted-dataset profile. */
  fixedDataset?: FixedDatasetConfig;
  /** Identity is resolved independently of the deployment profile. */
  identity: IdentityConfig;
  /** Cross-device sync, gated on cloud identity. */
  sync: SyncConfig;
  /**
   * Where to reach the sibling Navigator app, when this deployment ships one.
   * A root-relative path (`/navigator/`) for co-deployments that stage
   * Navigator into the wiki's dist, or a full origin for a separate deploy.
   * Absent when the deployment doesn't offer Navigator — the sidebar link is
   * hidden in that case.
   */
  navigatorUrl?: string;
}

export type RawEnv = Record<string, string | undefined>;

const ANONYMOUS_IDENTITY: IdentityConfig = { mode: 'anonymous' };
const SYNC_OFF: SyncConfig = { mode: 'off' };

const GENERIC_FEATURES: DeploymentFeatureFlags = {
  enableUserImport: true,
  enableHostedDataset: false,
  enableAccounts: false,
  accountMenu: false,
  sync: false,
};

const DEFAULT_CHANNEL = 'latest';
const DEFAULT_REPOSITORY_BASE_URL = '/datasets';

/**
 * Resolve identity config from build-time env, independently of the deployment
 * profile, so either a generic-hosted or fixed-hosted-dataset build can opt into
 * accounts. Any value other than `cloud` for `VITE_IDENTITY_MODE` yields the
 * anonymous baseline, so existing builds and forks that set nothing are
 * unchanged and never bundle the auth SDK.
 *
 * A cloud build missing the Supabase URL or anon key is a misconfiguration and
 * throws — failing the build loudly is preferable to shipping a site whose
 * sign-in can never work.
 */
export function resolveIdentity(env: RawEnv): IdentityConfig {
  if (env.VITE_IDENTITY_MODE !== 'cloud') {
    return ANONYMOUS_IDENTITY;
  }

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  // Prefer the new publishable key; fall back to the legacy anon key, which
  // remains valid until Supabase retires it (end of 2026).
  const supabaseKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      '[scrolled/config] VITE_IDENTITY_MODE=cloud requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or the legacy VITE_SUPABASE_ANON_KEY)',
    );
  }

  const oauthProviders = (env.VITE_SUPABASE_OAUTH_PROVIDERS?.trim() || 'google')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  return { mode: 'cloud', cloud: { supabaseUrl, supabaseKey, oauthProviders } };
}

/**
 * Resolve sync config from build-time env, gated on the resolved identity. Any
 * value other than `supabase` for `VITE_SYNC_MODE` yields `off`, so existing
 * builds and forks that set nothing never reach the sync transport.
 *
 * `supabase` sync requires `cloud` identity — there is no account to scope
 * synced data to otherwise — so a build that asks for sync without cloud
 * identity is a misconfiguration and throws, matching `resolveIdentity`'s
 * loud-fail style. The transport reuses the cloud identity's Supabase project,
 * so no separate URL/key env is needed.
 */
export function resolveSync(env: RawEnv, identity: IdentityConfig): SyncConfig {
  if (env.VITE_SYNC_MODE !== 'supabase') {
    return SYNC_OFF;
  }
  if (identity.mode !== 'cloud') {
    throw new Error(
      '[scrolled/config] VITE_SYNC_MODE=supabase requires VITE_IDENTITY_MODE=cloud (sync scopes data to an account)',
    );
  }
  return { mode: 'supabase' };
}

/**
 * Resolve the deployment config from build-time env. Any value other than
 * `fixed-hosted-dataset` for `VITE_DEPLOYMENT_PROFILE` yields the generic
 * profile, so existing builds and forks that set nothing are unchanged.
 *
 * A fixed build with no `VITE_DATASET_FAMILY` is a build misconfiguration and
 * throws — failing the build loudly is preferable to shipping a site that can
 * never install its dataset.
 */
/**
 * Where the sibling Navigator app is reachable, if this deployment ships one.
 * Unset (or an empty/whitespace value) means no Navigator — the wiki hides the
 * sidebar link entirely. Kept as an opaque string (no origin validation) so
 * co-deployments can pass a root-relative path like `/navigator/` and separate
 * deploys can pass a full origin.
 */
export function resolveNavigatorUrl(env: RawEnv): string | undefined {
  const raw = env.VITE_NAVIGATOR_URL?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export function resolveAppConfig(env: RawEnv): AppConfig {
  const identity = resolveIdentity(env);
  const sync = resolveSync(env, identity);
  const navigatorUrl = resolveNavigatorUrl(env);
  const accountFeatures = {
    enableAccounts: identity.mode === 'cloud',
    accountMenu: identity.mode === 'cloud',
    sync: sync.mode === 'supabase',
  };

  if (env.VITE_DEPLOYMENT_PROFILE !== 'fixed-hosted-dataset') {
    return {
      deploymentProfile: 'generic',
      features: { ...GENERIC_FEATURES, ...accountFeatures },
      identity,
      sync,
      navigatorUrl,
    };
  }

  const family = env.VITE_DATASET_FAMILY?.trim();
  if (!family) {
    throw new Error(
      '[scrolled/config] VITE_DEPLOYMENT_PROFILE=fixed-hosted-dataset requires VITE_DATASET_FAMILY',
    );
  }

  const channel = env.VITE_DATASET_CHANNEL?.trim() || DEFAULT_CHANNEL;
  const repositoryBaseUrl = (
    env.VITE_DATASET_REPO_URL?.trim() || DEFAULT_REPOSITORY_BASE_URL
  ).replace(/\/+$/, '');

  return {
    deploymentProfile: 'fixed-hosted-dataset',
    features: {
      enableUserImport: false,
      enableHostedDataset: true,
      ...accountFeatures,
    },
    fixedDataset: { family, channel, repositoryBaseUrl },
    identity,
    sync,
    navigatorUrl,
  };
}
