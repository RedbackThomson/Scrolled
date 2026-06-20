// Drives the one-time install of the fixed deployment's hosted dataset: resolve
// the channel, download the artifact, and restore it into the local databases
// via the existing backup importer (which runs migrations and the data-revision
// gate). On success it invalidates the db queries so AppShell re-evaluates and
// swaps the install screen for the app.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { installDataset, type InstallProgress } from '@scrolled/dataset-client';
import { StaticHttpDatasetRepository } from '@scrolled/dataset-repository';
import { appConfig } from '@/config';
import { importBackupBytes } from '@/hooks/useBackup';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('dataset-install');

export type InstallStatus = 'running' | 'error' | 'done';

export interface FixedDatasetInstall {
  status: InstallStatus;
  progress: InstallProgress | null;
  error: Error | null;
  retry: () => void;
}

export function useFixedDatasetInstall(): FixedDatasetInstall {
  const qc = useQueryClient();
  const [status, setStatus] = useState<InstallStatus>('running');
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    const fixed = appConfig.fixedDataset;
    if (!fixed || runningRef.current) return;
    runningRef.current = true;
    setStatus('running');
    setError(null);
    setProgress(null);
    try {
      const repository = new StaticHttpDatasetRepository(fixed.repositoryBaseUrl);
      await installDataset({
        repository,
        ref: { family: fixed.family, channel: fixed.channel },
        sink: {
          install: async (bytes) => {
            await importBackupBytes(bytes);
          },
        },
        onProgress: setProgress,
      });
      await qc.invalidateQueries({ queryKey: ['db'] });
      setStatus('done');
    } catch (e) {
      log.error('dataset install failed', describeError(e));
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [qc]);

  useEffect(() => {
    void run();
    // Install runs once when the screen mounts; `retry` re-invokes on demand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = useCallback(() => {
    void run();
  }, [run]);

  return { status, progress, error, retry };
}
