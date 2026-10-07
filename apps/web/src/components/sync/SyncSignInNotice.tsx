import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { appConfig } from '@/config';
import { cn } from '@scrolled/design';

const NOTICE = 'Sign in to save your collections and preferences across devices.';

/**
 * A sidebar notice, shown above the database status, inviting a signed-out user
 * to sign in for cross-device sync. Only on a deployment with sync enabled;
 * disappears once signed in (where the sync status line takes over). Persistent
 * and links to sign-in.
 */
export function SyncSignInNotice({ collapsed }: { collapsed: boolean }) {
  const user = useCurrentUser();
  if (!appConfig.features.sync || user.isAuthenticated) return null;

  return (
    <Link
      to="/sign-in"
      title={NOTICE}
      className={cn(
        'hover:bg-muted block rounded-[14px] transition-colors',
        collapsed ? 'flex justify-center py-2' : 'px-3.5 py-1.5',
      )}
    >
      <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
        <Info className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
        {collapsed ? <span className="sr-only">{NOTICE}</span> : 'Sync available'}
      </span>
      {!collapsed && (
        <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">{NOTICE}</p>
      )}
    </Link>
  );
}
