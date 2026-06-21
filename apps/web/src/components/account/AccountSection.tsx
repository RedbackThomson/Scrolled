import { UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { Button } from '@/components/ui/button';
import { appConfig } from '@/config';

export function AccountSection() {
  if (!appConfig.features.accountMenu) return null;
  return <AccountSectionInner />;
}

function AccountSectionInner() {
  const sectionProps = useSettingsSection('account');
  const user = useCurrentUser();
  const { logout } = useIdentity();
  const navigate = useNavigate();

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <UserCircle className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Account</h2>
      </div>
      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        {user.isAuthenticated ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {user.displayName ?? user.email ?? 'Signed in'}
              </div>
              {user.email && (
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{user.email}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Not signed in</div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Sign in to keep your collections and preferences with your account.
              </p>
            </div>
            <Button size="sm" onClick={() => navigate('/sign-in')}>
              Sign in
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
