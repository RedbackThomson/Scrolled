// Applying a hosted dataset to the local databases, beyond writing its bytes:
// pin the server profile the dataset requires and record the installed version.
// Shared by the install flow (first install) and the update flow.

import type { DatasetManifest } from '@scrolled/dataset-core';
import { getDbClient } from '@/db';
import { serverProfileExists } from '@scrolled/extractor/serverProfiles';
import { DatasetUnsupportedError } from '@/hooks/dataset/errors';

/**
 * Reject a dataset whose required server profile this build doesn't ship — run
 * before downloading, so a stale app fails fast with an "update the app" message
 * instead of installing data it would render under the wrong rules.
 */
export function assertDatasetSupported(manifest: DatasetManifest): void {
  if (!serverProfileExists(manifest.serverProfileId)) {
    throw new DatasetUnsupportedError(
      `This data needs the "${manifest.serverProfileId}" server profile, which this version of ` +
        `the app doesn't include. Update the app to use it.`,
    );
  }
}

/**
 * Pin the dataset's server profile and record the installed version. Runs after
 * the import (which replaced the whole DB, including the profile singleton), so
 * the manifest's profile wins deterministically over whatever the backup carried.
 */
export async function applyInstalledDataset(manifest: DatasetManifest): Promise<void> {
  const db = getDbClient();
  await db.setServerProfile(manifest.serverProfileId);
  await db.setInstalledDataset({
    id: manifest.id,
    family: manifest.family,
    version: manifest.version,
    displayName: manifest.displayName,
    serverProfileId: manifest.serverProfileId,
    installedAt: new Date().toISOString(),
  });
}
