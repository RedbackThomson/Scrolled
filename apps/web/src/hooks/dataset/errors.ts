// Errors that mean "this app build can't serve this dataset — update the app",
// and a classifier the install/update UI uses to choose its messaging.

import { BackupIncompatibleError } from '@scrolled/game-db/db/backup';

/** The dataset requires something this build doesn't provide (e.g. a server profile). */
export class DatasetUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatasetUnsupportedError';
  }
}

/**
 * True when the failure means the running app is too old/incomplete for the
 * dataset and the fix is updating the app (not retrying the download).
 */
export function isAppUpdateRequired(error: unknown): boolean {
  if (error instanceof DatasetUnsupportedError) return true;
  if (error instanceof BackupIncompatibleError) return error.kind === 'app-too-old';
  return false;
}
