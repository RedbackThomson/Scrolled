// Applying a hosted dataset to the local databases, beyond writing its bytes:
// pin the server profile the dataset requires and record the installed version.
// Shared by the install flow (first install) and the update flow.

import type { DatasetManifest } from '@scrolled/dataset-core';
import { getDbClient } from '@/db';
import { equipStatCalculatorExists } from '@scrolled/game-db/serverProfiles';
import { CURRENT_DATA_REVISION } from '@scrolled/game-db/db';
import { LATEST_SCHEMA_VERSION } from '@scrolled/game-db/db/migrations';
import { DatasetUnsupportedError } from '@/hooks/dataset/errors';

/**
 * Reject — before the (large) download — a dataset this build can't render, so a
 * stale app fails fast with an "update the app" message instead of fetching data
 * it can't use. The manifest carries the full compatibility contract; the
 * at-install `evaluateDatasetImport` is the backstop for the data inside.
 *
 * The server *profile* is not checked: it travels inside the bundle and is
 * applied on install, so a dataset can name a profile this build has never seen.
 * Only the *calculator* it references is a hard app dependency — that's code,
 * keyed by id — alongside the data-revision / schema contract.
 */
export function assertDatasetSupported(manifest: DatasetManifest): void {
  if (!equipStatCalculatorExists(manifest.calculatorId)) {
    throw new DatasetUnsupportedError(
      `This data uses the "${manifest.calculatorId}" stat calculator, which this version of the ` +
        `app doesn't include. Update the app to use it.`,
    );
  }
  if (manifest.schemaVersion > LATEST_SCHEMA_VERSION) {
    throw new DatasetUnsupportedError(
      `This data uses a newer database format (schema ${manifest.schemaVersion}) than this app ` +
        `supports (up to ${LATEST_SCHEMA_VERSION}). Update the app to use it.`,
    );
  }
  if (manifest.dataRevision > CURRENT_DATA_REVISION) {
    throw new DatasetUnsupportedError(
      `This data (revision ${manifest.dataRevision}) was built by a newer version of the app than ` +
        `this one (which supports up to revision ${CURRENT_DATA_REVISION}). Update the app to use it.`,
    );
  }
}

/**
 * Record the installed version after the import. The dataset's game DB already
 * carries its server profile (the build baked it in), so there's nothing to pin
 * here — re-pinning by id would clear that inline config.
 */
export async function applyInstalledDataset(manifest: DatasetManifest): Promise<void> {
  const db = getDbClient();
  await db.setInstalledDataset({
    id: manifest.id,
    family: manifest.family,
    version: manifest.version,
    displayName: manifest.displayName,
    serverProfileId: manifest.serverProfileId,
    installedAt: new Date().toISOString(),
  });
}
