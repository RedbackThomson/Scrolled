import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { appConfig } from '@/config';
import { cn } from '@/lib/utils';
import { presentSyncStatus } from './syncPresentation';

// Icon colour per tone — the indicator is a bare icon, so it wants a text
// colour, not the Badge pill background.
const TONE_TEXT: Record<string, string> = {
  slate: 'text-muted-foreground',
  blue: 'text-blue-600 dark:text-blue-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
};

/**
 * The top-bar sync indicator: one icon reflecting the current state (syncing /
 * synced / offline / needs attention), opening the Sync settings on click. Only
 * mounted on a deployment with sync enabled and a signed-in user — signed out,
 * the account control already invites sign-in, so a sync icon would be noise.
 */
export function SyncStatusIndicator() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { status } = useSyncStatus();

  if (!appConfig.features.sync || !user.isAuthenticated) return null;

  const { label, detail, icon: Icon, tone, spin } = presentSyncStatus(status);

  return (
    <button
      type="button"
      onClick={() => navigate('/settings#sync')}
      aria-label={`Sync: ${label}. ${detail}`}
      title={detail}
      className="hover:bg-accent focus-visible:ring-ring focus-visible:ring-offset-background inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      <Icon className={cn('h-4 w-4', TONE_TEXT[tone], spin && 'animate-spin')} />
    </button>
  );
}
