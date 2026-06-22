import { UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { Button } from '@/components/ui/button';
import { SyncControls } from '@/components/sync/SyncControls';
import { appConfig } from '@/config';
import { oauthProviderLabel } from '@/lib/oauthProviders';

export function AccountSection() {
  if (!appConfig.features.accountMenu) return null;
  return <AccountSectionInner />;
}

// Sync is meaningless without an account, so it lives here rather than as its own
// section — signed out, the account sign-in card already covers it; signed in,
// the sync status/controls sit below the identity. Only when sync is actually
// enabled for the deployment (sync requires cloud identity, so this implies
// accounts are on too).
function AccountSectionInner() {
  const sectionProps = useSettingsSection('account');
  const user = useCurrentUser();
  const { logout } = useIdentity();
  const navigate = useNavigate();
  const sync = appConfig.features.sync;

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <UserCircle className="h-4 w-4" />
        <h2 className="text-lg font-semibold">{sync ? 'Account & Sync' : 'Account'}</h2>
      </div>
      <div className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4">
        {user.isAuthenticated ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {user.displayName ?? user.email ?? 'Signed in'}
                </div>
                {user.email && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">{user.email}</p>
                )}
                {user.provider && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    Signed in with {oauthProviderLabel(user.provider)}
                  </p>
                )}
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => void logout()}>
                Sign out
              </Button>
            </div>
            {sync && <SyncControls />}
          </>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Not signed in</div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {sync
                  ? 'Sign in to keep your collections, pinned searches, and preferences across your devices.'
                  : 'Sign in to keep your collections and preferences with your account.'}
              </p>
            </div>
            <Button size="sm" className="shrink-0" onClick={() => navigate('/sign-in')}>
              Sign in
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
