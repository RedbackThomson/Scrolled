import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { Button } from '@/components/ui/button';
import { getUserDbClient } from '@/db/user';
import { appConfig } from '@/config';
import { cn } from '@/lib/utils';
import { presentSyncStatus, formatLastSynced } from '@/components/sync/syncPresentation';

const TONE_TEXT: Record<string, string> = {
  slate: 'text-muted-foreground',
  blue: 'text-blue-600 dark:text-blue-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

/**
 * Settings → Sync. Surfaces what cross-device sync is doing — current state,
 * when it last completed, how many local changes are still pending — plus a
 * manual "sync now" and this device's id (the seed of a future device list).
 * Only mounted when the deployment enables sync; signed out, it invites sign-in.
 */
export function SyncSection() {
  if (!appConfig.features.sync) return null;
  return <SyncSectionInner />;
}

function SyncSectionInner() {
  const sectionProps = useSettingsSection('sync');
  const user = useCurrentUser();

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <RefreshCw className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Sync</h2>
      </div>
      <div className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4">
        {user.isAuthenticated ? <SignedInSync /> : <SignedOutSync />}
      </div>
    </section>
  );
}

function SignedOutSync() {
  const navigate = useNavigate();
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Not syncing</div>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Sign in to keep your collections, pinned searches, and preferences across your devices.
          Until then they stay on this device.
        </p>
      </div>
      <Button size="sm" onClick={() => navigate('/sign-in')}>
        Sign in
      </Button>
    </div>
  );
}

function SignedInSync() {
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
    <>
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
        <Button variant="outline" size="sm" disabled={syncing} onClick={() => void onSyncNow()}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync now
        </Button>
      </div>

      {status.errorKind === 'auth' && (
        <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
          <p className="text-muted-foreground text-xs">
            Your session expired. Sign in again to resume syncing.
          </p>
          <Button size="sm" onClick={() => navigate('/sign-in')}>
            Sign in again
          </Button>
        </div>
      )}

      <dl className="border-border grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 text-xs">
        <dt className="text-muted-foreground">Last synced</dt>
        <dd className="text-right">{formatLastSynced(status.lastSyncedAt, Date.now())}</dd>
        <dt className="text-muted-foreground">Pending changes</dt>
        <dd className="text-right font-mono">{status.pendingChanges.toLocaleString()}</dd>
        <dt className="text-muted-foreground">This device</dt>
        <dd className="truncate text-right font-mono" title={metaQ.data?.deviceId}>
          {metaQ.data?.deviceId ? metaQ.data.deviceId.slice(0, 12) : '—'}
        </dd>
      </dl>
    </>
  );
}
