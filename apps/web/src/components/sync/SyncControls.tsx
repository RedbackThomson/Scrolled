import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { Button } from '@scrolled/ui';
import { getUserDbClient } from '@/db/user';
import { cn } from '@scrolled/ui';
import { presentSyncStatus, formatLastSynced } from './syncPresentation';
import { SyncResyncButton } from './SyncResyncButton';

const TONE_TEXT: Record<string, string> = {
  slate: 'text-muted-foreground',
  blue: 'text-blue-600 dark:text-blue-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

/**
 * The signed-in sync panel — current state, last-synced, pending count, a manual
 * "sync now", and this device's id (the seed of a future device list). Rendered
 * inside the Account section (sync only matters with an account), so it assumes a
 * signed-in user on a sync-enabled deployment; the caller gates both.
 */
export function SyncControls() {
  const navigate = useNavigate();
  const { status, syncNow } = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const presentation = presentSyncStatus(status);
  const Icon = presentation.icon;

  const metaQ = useQuery({
    queryKey: ['sync', 'meta'],
    queryFn: () => getUserDbClient().getSyncMeta(),
    staleTime: Infinity,
  });

  const onSyncNow = async () => {
    setBusy(true);
    try {
      await syncNow();
    } finally {
      setBusy(false);
    }
  };

  const syncing = status.state === 'syncing' || busy;

  return (
    <div className="border-border space-y-4 border-t pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0',
              TONE_TEXT[presentation.tone],
              presentation.spin && 'animate-spin',
            )}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium">{presentation.label}</div>
            <p className="text-muted-foreground mt-0.5 text-xs">{presentation.detail}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <SyncResyncButton disabled={syncing} />
          <Button variant="outline" size="sm" disabled={syncing} onClick={() => void onSyncNow()}>
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync now
          </Button>
        </div>
      </div>

      {status.errorKind === 'auth' && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            Your session expired. Sign in again to resume syncing.
          </p>
          <Button size="sm" className="shrink-0" onClick={() => navigate('/sign-in')}>
            Sign in again
          </Button>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted-foreground">Last synced</dt>
        <dd className="text-right">{formatLastSynced(status.lastSyncedAt, Date.now())}</dd>
        <dt className="text-muted-foreground">Pending changes</dt>
        <dd className="text-right font-mono">{status.pendingChanges.toLocaleString()}</dd>
        <dt className="text-muted-foreground">This device</dt>
        <dd className="truncate text-right font-mono" title={metaQ.data?.deviceId}>
          {metaQ.data?.deviceId ? metaQ.data.deviceId.slice(0, 12) : '—'}
        </dd>
      </dl>
    </div>
  );
}
