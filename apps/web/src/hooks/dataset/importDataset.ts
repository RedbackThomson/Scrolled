// Install a downloaded `.scrolled-dataset` into the local game database. Unpacks
// the container, gates the data against this build's revision/schema (a backstop
// to the pre-download manifest check), then replaces the game DB. User data is
// untouched — a dataset carries game data only; backups (.scrolled-backup) are a
// separate flow (see ../useBackup).

import { readDataset } from '@scrolled/dataset-core';
import { evaluateDatasetImport } from '@scrolled/game-db/db';
import { getDbClient } from '@/db';
import { DatasetUnsupportedError } from '@/hooks/dataset/errors';

export async function importDatasetBytes(bytes: Uint8Array): Promise<void> {
  const { manifest, game } = await readDataset(bytes);
  const decision = evaluateDatasetImport(manifest);
  if (decision.blocked) {
    throw new DatasetUnsupportedError(
      decision.reason ?? 'This dataset is not compatible with this version of the app.',
    );
  }
  // Migrations run inside importBytes, bringing an older-but-readable schema current.
  await getDbClient().importBytes(game);
}
