import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { appConfig } from '@/config';

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

  if (collapsed) {
    return (
      <Link
        to="/sign-in"
        title={NOTICE}
        aria-label={NOTICE}
        className="hover:bg-accent flex justify-center rounded-md px-2 py-2 transition-colors"
      >
        <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
      </Link>
    );
  }

  return (
    <Link
      to="/sign-in"
      className="hover:bg-accent border-border/60 bg-accent/40 mx-3 mt-3 block rounded-md border px-3 py-2 transition-colors"
    >
      <div className="flex items-center gap-2 text-xs">
        <Info className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
        <span className="text-sidebar-foreground font-medium">Sync available</span>
      </div>
      <p className="text-sidebar-muted mt-0.5 text-[11px] leading-snug">{NOTICE}</p>
    </Link>
  );
}
