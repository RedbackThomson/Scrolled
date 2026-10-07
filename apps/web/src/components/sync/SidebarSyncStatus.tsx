import { Link } from 'react-router-dom';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { appConfig } from '@/config';
import { Loader2 } from 'lucide-react';
import { cn, StatusDot } from '@scrolled/design';
import { presentSyncStatus } from './syncPresentation';

// Dot per tone, matching the database status row's palette.
const DOT: Record<string, 'ok' | 'warn' | 'danger' | 'offline'> = {
  slate: 'offline',
  blue: 'offline',
  amber: 'warn',
  red: 'danger',
  emerald: 'ok',
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

  const { label, detail, tone, spin } = presentSyncStatus(status);
  const shown = collapsed ? undefined : label;

  const body = (
    <div className="flex items-center gap-2">
      {spin ? (
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
          <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          {shown}
        </span>
      ) : (
        <StatusDot status={DOT[tone] ?? 'offline'} label={shown} />
      )}
      {collapsed && <span className="sr-only">{label}</span>}
    </div>
  );

  return (
    <Link
      to="/settings/account#account"
      title={detail}
      className={cn(
        'hover:bg-muted block rounded-[14px] transition-colors',
        collapsed ? 'flex justify-center py-2' : 'px-3.5 py-1.5',
      )}
    >
      {body}
    </Link>
  );
}
