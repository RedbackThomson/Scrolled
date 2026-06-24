// Detects when an update to the fixed deployment's hosted dataset is warranted
// and applies it in place (download + restore). Two independent reasons qualify:
// the repository published a newer version string, or the installed data predates
// this build's data contract (a data-revision bump that needs the rebuilt bundle
// to populate new columns/tables). Only meaningful on a fixed-dataset deployment;
// resolves the channel over the network, so it stays silent when offline or when
// no dataset is installed yet.

import { useCallback, useMemo } from 'react';
import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { installDataset } from '@scrolled/dataset-client';
import { StaticHttpDatasetRepository } from '@scrolled/dataset-repository';
import { appConfig } from '@/config';
import { getDbClient } from '@/db';
import { useDataState } from '@/hooks/useDataState';
import { importDatasetBytes } from '@/hooks/dataset/importDataset';
import { applyInstalledDataset, assertDatasetSupported } from '@/hooks/dataset/registry';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';

const log = createLogger('dataset-update');

/**
 * How an available update should be surfaced:
 *   - `auto`: this build expects newer data than is installed (a data-revision
 *     gap) — the app was updated and the dataset must catch up, so it is applied
 *     without a second click.
 *   - `offer`: the publisher re-issued the bundle at the same revision this build
 *     already runs — a genuinely optional refresh, shown as a dismissible nudge.
 *   - `none`: nothing to do.
 */
export type DatasetUpdateMode = 'none' | 'auto' | 'offer';

// Shared key so the apply's pending/error state is observable from every
// consumer (sidebar status row, version tag, settings) regardless of which one
// triggered it — the auto-update fires from a single headless mount, but the
// progress and failure surface elsewhere.
const DATASET_APPLY_KEY = ['dataset', 'apply'];

export interface DatasetUpdate {
  /** True when an update is available in either mode. */
  available: boolean;
  mode: DatasetUpdateMode;
  /** The version currently installed, or null on a generic build / before install. */
  installedVersion: string | null;
  latestVersion: string | null;
  displayName: string | null;
  applying: boolean;
  error: Error | null;
  apply: () => void;
}

export function useDatasetUpdate(): DatasetUpdate {
  const qc = useQueryClient();
  const fixed = appConfig.fixedDataset;
  // The installed library's revision vs. this build's data contract. Stale data
  // warrants the rebuilt bundle even when its version string is unchanged — a
  // data-revision bump alone wouldn't otherwise be detected here.
  const { state: dataState } = useDataState();
  const repository = useMemo(
    () => (fixed ? new StaticHttpDatasetRepository(fixed.repositoryBaseUrl) : null),
    [fixed],
  );

  const installedQ = useQuery({
    queryKey: ['db', 'installed-dataset'],
    queryFn: () => getDbClient().getInstalledDataset(),
    enabled: !!fixed,
  });

  const latestQ = useQuery({
    queryKey: ['dataset', 'channel', fixed?.family ?? '', fixed?.channel ?? ''],
    queryFn: () => repository!.resolveChannel({ family: fixed!.family, channel: fixed!.channel }),
    // Only check for an update once we know something is installed.
    enabled: !!fixed && !!repository && !!installedQ.data,
    retry: false,
    staleTime: 60_000,
  });

  const applyM = useMutation({
    mutationKey: DATASET_APPLY_KEY,
    mutationFn: async () => {
      if (!repository || !fixed) return;
      const manifest = await installDataset({
        repository,
        ref: { family: fixed.family, channel: fixed.channel },
        onManifest: assertDatasetSupported,
        sink: {
          install: async (bytes) => {
            await importDatasetBytes(bytes);
          },
        },
      });
      await applyInstalledDataset(manifest);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['db'] });
      qc.invalidateQueries({ queryKey: ['dataset', 'channel'] });
    },
    onError: (e) => log.error('dataset update failed', describeError(e)),
  });

  // Pending/error of the most recent apply, from the shared mutation cache so
  // every consumer sees it — not just the instance that called `apply`.
  const applyStates = useMutationState({
    filters: { mutationKey: DATASET_APPLY_KEY },
    select: (m) => ({ status: m.state.status, error: (m.state.error as Error | null) ?? null }),
  });
  const lastApply = applyStates.at(-1);
  const applying = lastApply?.status === 'pending';
  const error = lastApply?.error ?? null;

  const installed = installedQ.data ?? null;
  const latest = latestQ.data ?? null;
  // Mode is derived purely from the queries: once an apply lands, the refetched
  // installed version / data state collapse it back to `none` on their own.
  const dataStale = dataState === 'update-recommended' || dataState === 'reinitialize-required';
  const mode: DatasetUpdateMode =
    !installed || !latest
      ? 'none'
      : dataStale
        ? 'auto'
        : latest.version !== installed.version
          ? 'offer'
          : 'none';

  const apply = useCallback(() => applyM.mutate(), [applyM]);

  return {
    available: mode !== 'none',
    mode,
    installedVersion: installed?.version ?? null,
    latestVersion: latest?.version ?? null,
    displayName: latest?.displayName ?? installed?.displayName ?? null,
    applying,
    error,
    apply,
  };
}
