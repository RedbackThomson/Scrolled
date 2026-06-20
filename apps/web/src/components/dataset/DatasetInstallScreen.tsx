// Full-screen install flow shown on a fixed-dataset deployment when the local
// library is empty. Downloads and installs the hosted dataset, then steps aside
// as AppShell renders the app. Copy uses the dataset's display name from the
// manifest (data, not source) and otherwise stays generic.

import { AlertCircle, Loader2 } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { BackupIncompatibleError } from '@/db/backup';
import { useFixedDatasetInstall } from '@/hooks/dataset/useFixedDatasetInstall';
import { reloadForUpdate } from '@/lib/swReload';

function formatMb(bytes: number): string {
  return (bytes / 1_000_000).toFixed(1);
}

export function DatasetInstallScreen() {
  const { status, progress, error, retry } = useFixedDatasetInstall();
  const { updateServiceWorker } = useRegisterSW();
  const name = progress?.manifest?.displayName ?? 'your library';

  // The dataset was built by a newer app than this (cached) build. Retrying
  // can't help — the app itself must update. The PWA prompt isn't rendered on
  // this blocking screen, so offer the update here.
  const needsAppUpdate =
    error instanceof BackupIncompatibleError && error.kind === 'app-too-old';

  const download = progress?.download;
  const percent =
    download && download.totalBytes
      ? Math.min(100, Math.round((download.receivedBytes / download.totalBytes) * 100))
      : null;

  let label: string;
  switch (progress?.phase ?? 'resolving') {
    case 'downloading':
      label = `Downloading ${name}…`;
      break;
    case 'installing':
      label = `Installing ${name}…`;
      break;
    case 'done':
      label = 'Ready';
      break;
    default:
      label = 'Preparing…';
  }

  return (
    <div
      className="bg-background text-foreground fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      aria-busy={status === 'running'}
      role="status"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <p className="text-2xl font-semibold tracking-tight">Scrolled</p>

        {status === 'error' ? (
          <>
            <AlertCircle className="text-destructive h-7 w-7" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {needsAppUpdate ? 'This site needs to update' : "Couldn't install the dataset"}
              </p>
              <p className="text-muted-foreground text-xs">
                {error?.message ?? 'Something went wrong while downloading.'}
              </p>
            </div>
            {needsAppUpdate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => reloadForUpdate(updateServiceWorker)}
              >
                Reload to update
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                Try again
              </Button>
            )}
          </>
        ) : (
          <>
            <Loader2 className="text-primary h-7 w-7 animate-spin" aria-hidden />
            <div className="w-full space-y-2">
              <p className="text-sm">{label}</p>
              {progress?.phase === 'downloading' && (
                <>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full transition-[width] duration-200"
                      style={{ width: percent === null ? '40%' : `${percent}%` }}
                    />
                  </div>
                  {download && (
                    <p className="text-muted-foreground text-xs">
                      {formatMb(download.receivedBytes)}
                      {download.totalBytes ? ` / ${formatMb(download.totalBytes)}` : ''} MB
                    </p>
                  )}
                </>
              )}
              <p className="text-muted-foreground text-xs">This downloads once and then works offline.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
