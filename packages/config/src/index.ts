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
}

export interface FixedDatasetConfig {
  /** Dataset family to install, e.g. the slug a repository organizes versions under. */
  family: string;
  /** Channel that resolves to a concrete immutable version, e.g. "latest". */
  channel: string;
  /** Base URL of the static dataset repository (no trailing slash). */
  repositoryBaseUrl: string;
}

export interface AppConfig {
  deploymentProfile: DeploymentProfile;
  features: DeploymentFeatureFlags;
  /** Present only for the fixed-hosted-dataset profile. */
  fixedDataset?: FixedDatasetConfig;
}

export type RawEnv = Record<string, string | undefined>;

const GENERIC_CONFIG: AppConfig = {
  deploymentProfile: 'generic',
  features: { enableUserImport: true, enableHostedDataset: false },
};

const DEFAULT_CHANNEL = 'latest';
const DEFAULT_REPOSITORY_BASE_URL = '/datasets';

/**
 * Resolve the deployment config from build-time env. Any value other than
 * `fixed-hosted-dataset` for `VITE_DEPLOYMENT_PROFILE` yields the generic
 * profile, so existing builds and forks that set nothing are unchanged.
 *
 * A fixed build with no `VITE_DATASET_FAMILY` is a build misconfiguration and
 * throws — failing the build loudly is preferable to shipping a site that can
 * never install its dataset.
 */
export function resolveAppConfig(env: RawEnv): AppConfig {
  if (env.VITE_DEPLOYMENT_PROFILE !== 'fixed-hosted-dataset') {
    return GENERIC_CONFIG;
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
    features: { enableUserImport: false, enableHostedDataset: true },
    fixedDataset: { family, channel, repositoryBaseUrl },
  };
}
