// Data revision: the format/contract of the *extracted data*, independent of
// the SQL schema version tracked by `_migrations`.
//
// The schema migration runner handles DDL changes automatically (it can add a
// column), but it cannot regenerate data that only re-parsing the source game
// files can produce — e.g. a new column stays NULL until extraction runs
// again. The SQLite library is a derived cache of the user's game files; when
// its contents are incompatible with the current build we don't migrate, we
// signal "rebuild from source" (re-run setup).
//
// Bump these by hand when shipping a change that requires re-extraction. See
// the backward-compatibility policy in CLAUDE.md / DEVELOPMENT.md before
// touching them — they gate data integrity for every existing user.

/** Revision the current build produces when extraction runs. */
export const CURRENT_DATA_REVISION: number = 11;

/**
 * Lowest revision the current build can still read. Data below this is treated
 * as unusable and the user is forced to reinitialize. For a breaking change,
 * raise this to equal CURRENT_DATA_REVISION; for an additive feature that only
 * needs a refresh, leave it and bump CURRENT_DATA_REVISION alone.
 */
export const MINIMUM_SUPPORTED_DATA_REVISION: number = 5;

export type DataState =
  /** Cache matches the current build — nothing to do. */
  | 'current'
  /** Older but still readable — re-running setup unlocks newer features. */
  | 'update-recommended'
  /** Too old to read — the user must clear and reload to continue. */
  | 'reinitialize-required';

/**
 * Classify a stored data revision against this build's thresholds. Callers must
 * only invoke this when the library actually has data; an empty library is
 * "first run", which is owned by the setup redirect, not this function.
 */
export function evaluateDataState(dataRevision: number): DataState {
  if (dataRevision < MINIMUM_SUPPORTED_DATA_REVISION) return 'reinitialize-required';
  if (dataRevision < CURRENT_DATA_REVISION) return 'update-recommended';
  return 'current';
}
