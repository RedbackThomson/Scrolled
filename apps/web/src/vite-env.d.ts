/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_COMMIT?: string;
  readonly VITE_ANALYTICS_PROVIDER?: string;
  readonly VITE_ANALYTICS_TOKEN?: string;
  readonly VITE_ANALYTICS_ALLOWED_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
