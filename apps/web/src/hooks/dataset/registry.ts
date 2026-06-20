// Applying a hosted dataset to the local databases, beyond writing its bytes:
// pin the server profile the dataset requires and record the installed version.
// Shared by the install flow (first install) and the update flow.

import type { DatasetManifest } from '@scrolled/dataset-core';
import { getDbClient } from '@/db';
import { serverProfileExists, equipStatCalculatorExists } from '@scrolled/extractor/serverProfiles';
import { CURRENT_DATA_REVISION } from '@scrolled/extractor/db';
import { LATEST_SCHEMA_VERSION } from '@scrolled/extractor/db/migrations';
import { DatasetUnsupportedError } from '@/hooks/dataset/errors';

/**
 * Reject — before the (large) download — a dataset this build can't render, so a
 * stale app fails fast with an "update the app" message instead of fetching data
 * it can't use. The manifest carries the full compatibility contract; the
 * at-import `evaluateBackupImport` is the backstop for the data inside.
 */
export function assertDatasetSupported(manifest: DatasetManifest): void {
  if (!serverProfileExists(manifest.serverProfileId)) {
    throw new DatasetUnsupportedError(
      `This data needs the "${manifest.serverProfileId}" server profile, which this version of ` +
        `the app doesn't include. Update the app to use it.`,
    );
  }
  // The profile config travels in the bundle, but the calculator is code keyed
  // by id — a brand-new algorithm needs an app release.
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
 * Pin the dataset's profile and record the installed version. Runs after the
 * import. A fixed-dataset bundle applies its full profile config inline during
 * import; only when none was applied (no inline config) do we fall back to
 * pinning the manifest's profile id, so the inline config always wins.
 */
export async function applyInstalledDataset(manifest: DatasetManifest): Promise<void> {
  const db = getDbClient();
  if (!(await db.getActiveServerProfile())) {
    await db.setServerProfile(manifest.serverProfileId);
  }
  await db.setInstalledDataset({
    id: manifest.id,
    family: manifest.family,
    version: manifest.version,
    displayName: manifest.displayName,
    serverProfileId: manifest.serverProfileId,
    installedAt: new Date().toISOString(),
  });
}
