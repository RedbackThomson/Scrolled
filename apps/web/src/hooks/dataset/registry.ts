// Records which hosted dataset version is installed into the game DB's app_meta
// store. Shared by the install flow (first install) and the update flow
// (replace-in-place), so the manifest -> record mapping lives in one place.

import type { DatasetManifest } from '@scrolled/dataset-core';
import { getDbClient } from '@/db';

export async function recordInstalledDataset(manifest: DatasetManifest): Promise<void> {
  await getDbClient().setInstalledDataset({
    id: manifest.id,
    family: manifest.family,
    version: manifest.version,
    displayName: manifest.displayName,
    installedAt: new Date().toISOString(),
  });
}
