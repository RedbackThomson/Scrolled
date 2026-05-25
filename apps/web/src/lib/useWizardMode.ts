import { useEffect, useState } from 'react';
import { useFeatures, type Features } from '@/lib/useFeatures';

export type WizardMode = 'first-run' | 'update' | 'restore';

export interface WizardModeState {
  /** Resolved mode. `null` while features are still resolving. */
  mode: WizardMode | null;
  /** True once feature flags have settled and `mode` is safe to use. */
  isReady: boolean;
  /** Underlying features object — already loaded, useful for entity counts. */
  features: Features;
  /** Toggle the restore-from-backup flow on/off. */
  setRestore: (active: boolean) => void;
  /** True if `setRestore(true)` was called. */
  restoreActive: boolean;
}

type StickyMode = 'first-run' | 'update';

/**
 * Resolves the wizard's current mode.
 *
 * - `restore` wins if the user has explicitly dropped a SQLite backup
 *   (caller flips this via `setRestore(true)`).
 * - Otherwise `first-run` when there is no data yet, `update` when there is.
 *
 * Once decided, the first/update choice **sticks for the lifetime of the
 * mount**. If we recomputed it from `features.isFirstRun` on every render,
 * a successful extraction (which flips `isFirstRun` to false and
 * invalidates the db queries) would briefly null out the mode mid-render
 * — unmounting StepRun and causing it to re-trigger extraction in a loop
 * when it remounts fresh.
 */
export function useWizardMode(): WizardModeState {
  const features = useFeatures();
  const [stickyMode, setStickyMode] = useState<StickyMode | null>(null);
  const [restoreActive, setRestoreActive] = useState(false);

  useEffect(() => {
    if (stickyMode !== null) return;
    if (!features.ready || features.isFetching) return;
    setStickyMode(features.isFirstRun ? 'first-run' : 'update');
  }, [features.ready, features.isFetching, features.isFirstRun, stickyMode]);

  const mode: WizardMode | null = restoreActive ? 'restore' : stickyMode;
  const isReady = mode !== null;

  return {
    mode,
    isReady,
    features,
    restoreActive,
    setRestore: setRestoreActive,
  };
}
