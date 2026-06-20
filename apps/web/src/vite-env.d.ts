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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
