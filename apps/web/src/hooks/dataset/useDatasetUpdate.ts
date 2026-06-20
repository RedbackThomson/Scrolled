// Detects when the repository's resolved `latest` is a newer version than the
// installed one, and applies it in place (download + restore). Only meaningful
// on a fixed-dataset deployment; resolves the channel over the network, so it
// stays silent when offline or when no dataset is installed yet.

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { installDataset } from '@scrolled/dataset-client';
import { StaticHttpDatasetRepository } from '@scrolled/dataset-repository';
import { appConfig } from '@/config';
import { getDbClient } from '@/db';
import { importDatasetBytes } from '@/hooks/dataset/importDataset';
import { applyInstalledDataset, assertDatasetSupported } from '@/hooks/dataset/registry';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';

const log = createLogger('dataset-update');

export interface DatasetUpdate {
  available: boolean;
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

  const installed = installedQ.data ?? null;
  const latest = latestQ.data ?? null;
  const available =
    !!installed && !!latest && latest.version !== installed.version && !applyM.isSuccess;

  const apply = useCallback(() => applyM.mutate(), [applyM]);

  return {
    available,
    installedVersion: installed?.version ?? null,
    latestVersion: latest?.version ?? null,
    displayName: latest?.displayName ?? installed?.displayName ?? null,
    applying: applyM.isPending,
    error: applyM.error,
    apply,
  };
}
