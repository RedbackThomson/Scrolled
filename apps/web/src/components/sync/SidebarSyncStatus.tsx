import { Link } from 'react-router-dom';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { appConfig } from '@/config';
import { cn } from '@/lib/utils';
import { presentSyncStatus } from './syncPresentation';

// Sidebar colour per tone, matching the DB status block's palette.
const TONE: Record<string, { icon: string; text: string }> = {
  slate: { icon: 'text-sidebar-muted', text: 'text-sidebar-foreground' },
  blue: { icon: 'text-sidebar-muted', text: 'text-sidebar-foreground' },
  amber: { icon: 'text-amber-600 dark:text-amber-400', text: 'text-amber-700 dark:text-amber-300' },
  red: { icon: 'text-red-600 dark:text-red-400', text: 'text-red-700 dark:text-red-300' },
  emerald: { icon: 'text-green-600 dark:text-green-400', text: 'text-sidebar-foreground' },
};

/**
 * A sidebar status line for sync, alongside the database health line. "Synced"
 * is the expected steady state, so it (and idle) are hidden — only the states
 * worth surfacing show: syncing, offline, or an error needing attention.
 * Clicking opens the Account & Sync settings. Only mounted with sync enabled and
 * a signed-in user; signed out is handled by the sign-in notice instead.
 */
export function SidebarSyncStatus({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser();
  const { status } = useSyncStatus();

  if (!appConfig.features.sync || !user.isAuthenticated) return null;
  if (status.state === 'synced' || status.state === 'idle') return null;

  const { label, detail, icon: Icon, tone, spin } = presentSyncStatus(status);
  const colour = TONE[tone] ?? TONE.slate;

  const body = collapsed ? (
    <Icon
      className={cn('h-4 w-4 shrink-0', colour.icon, spin && 'animate-spin')}
      aria-label={label}
    />
  ) : (
    <div className="flex items-center gap-2 text-xs">
      <Icon className={cn('h-3.5 w-3.5 shrink-0', colour.icon, spin && 'animate-spin')} aria-hidden />
      <span className={cn('truncate', colour.text)}>{label}</span>
    </div>
  );

  return (
    <Link
      to="/settings#account"
      title={detail}
      className={cn(
        'hover:bg-accent block rounded-md transition-colors',
        collapsed ? 'flex justify-center px-2 py-2' : 'px-3 pb-2 pt-3',
      )}
    >
      {body}
    </Link>
  );
}
