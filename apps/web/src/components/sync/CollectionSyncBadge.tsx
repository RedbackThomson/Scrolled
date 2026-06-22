import { useCurrentUser } from '@scrolled/identity-core/react';
import { Badge } from '@/components/ui/badge';
import { appConfig } from '@/config';

/**
 * A small per-collection hint about where the collection lives. On a deployment
 * with sync enabled: "Synced" when signed in (it rides with the account),
 * "Local only" when signed out (it stays on this device until you sign in). On a
 * self-hosted / sync-off build it renders nothing — everything is local and the
 * distinction would be meaningless.
 */
export function CollectionSyncBadge({ className }: { className?: string }) {
  const user = useCurrentUser();
  if (!appConfig.features.sync) return null;

  return user.isAuthenticated ? (
    <Badge tone="emerald" className={className}>
      Synced
    </Badge>
  ) : (
    <Badge tone="slate" className={className}>
      Local only
    </Badge>
  );
}
