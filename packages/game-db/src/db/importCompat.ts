// Whether a block of game data — from a `.scrolled-backup` import or a
// `.scrolled-dataset` install — may be loaded into *this* build, judged against
// its version thresholds. Pure so it can be unit-tested without a database.
//
// Both artifacts carry the same two numbers per game DB (schema version + data
// revision); the gate below is the single place that interprets them, so backup
// and dataset compatibility can never drift apart.

import { CURRENT_DATA_REVISION, MINIMUM_SUPPORTED_DATA_REVISION } from './dataVersion';
import { LATEST_SCHEMA_VERSION } from './migrations';
import type { DatasetContainerManifest } from '@scrolled/dataset-core';

/**
 * Why an import is blocked:
 *   - `data-too-old`: the data predates what this build can read — a newer
 *     dataset (or a rebuild from source) is needed.
 *   - `app-too-old`: the data was produced by a newer build — the app must be
 *     updated before it can be used.
 */
export type GameDataBlockKind = 'data-too-old' | 'app-too-old';

export interface GameDataImportDecision {
  /** When true, `reason` explains why the import must not proceed. */
  blocked: boolean;
  reason?: string;
  /** Set when `blocked` — lets the UI choose between "update app" and "newer data". */
  kind?: GameDataBlockKind;
  /** Non-blocking notices to surface after a successful import. */
  warnings: string[];
}

/**
 * The two-sided gate for a game database:
 *   - Too old: data below `MINIMUM_SUPPORTED_DATA_REVISION` is unreadable and
 *     blocked; below `CURRENT_DATA_REVISION` imports with a "re-run setup" nudge.
 *   - Too new: a schema beyond `LATEST_SCHEMA_VERSION` (migrations are
 *     forward-only) or a data revision beyond `CURRENT_DATA_REVISION` was
 *     produced by a newer build — opening it here could misread fields, so it is
 *     blocked with an "update the app" reason.
 * A `undefined` game section (e.g. a user-only backup) is never gated.
 */
export function evaluateGameDataImport(
  game: { dataRevision: number; schemaVersion: number } | undefined,
): GameDataImportDecision {
  const warnings: string[] = [];
  if (!game) return { blocked: false, warnings };

  if (game.dataRevision < MINIMUM_SUPPORTED_DATA_REVISION) {
    return {
      blocked: true,
      kind: 'data-too-old',
      reason:
        `This game data (revision ${game.dataRevision}) is older than this ` +
        `version of the app can read (it needs at least revision ${MINIMUM_SUPPORTED_DATA_REVISION}).`,
      warnings,
    };
  }
  if (game.schemaVersion > LATEST_SCHEMA_VERSION) {
    return {
      blocked: true,
      kind: 'app-too-old',
      reason:
        `This game data uses a newer database format (schema ${game.schemaVersion}) than this ` +
        `version of the app supports (up to ${LATEST_SCHEMA_VERSION}). Update the app to use it.`,
      warnings,
    };
  }
  if (game.dataRevision > CURRENT_DATA_REVISION) {
    return {
      blocked: true,
      kind: 'app-too-old',
      reason:
        `This game data (revision ${game.dataRevision}) was produced by a newer version of the ` +
        `app than this one (which supports up to revision ${CURRENT_DATA_REVISION}). Update the app to use it.`,
      warnings,
    };
  }
  if (game.dataRevision < CURRENT_DATA_REVISION) {
    warnings.push(
      `This game data (revision ${game.dataRevision}) predates this version ` +
        `(revision ${CURRENT_DATA_REVISION}). It will import, but re-running setup unlocks newer fields.`,
    );
  }
  return { blocked: false, warnings };
}

/** Gate a downloaded `.scrolled-dataset` against this build, before install. */
export function evaluateDatasetImport(manifest: DatasetContainerManifest): GameDataImportDecision {
  return evaluateGameDataImport(manifest.game);
}
