// Single resolution point for the deployment config. `appConfig` is a build
// constant — import it directly wherever a component or module needs to know
// whether user import is available or which fixed dataset to install.

import { resolveAppConfig, type AppConfig } from '@scrolled/config';

export const appConfig: AppConfig = resolveAppConfig(
  import.meta.env as unknown as Record<string, string | undefined>,
);

export type { AppConfig } from '@scrolled/config';
