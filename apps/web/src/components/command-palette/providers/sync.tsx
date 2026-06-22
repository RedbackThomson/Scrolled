import { LogIn, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { appConfig } from '@/config';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

/**
 * Sync actions in the palette: "Sync now" when signed in, a sign-in prompt when
 * signed out. Only present on a deployment with sync enabled (gated on
 * `appConfig.features.sync`), so self-hosted / sync-off builds show nothing.
 */
export function SyncProvider() {
  const navigate = useNavigate();
  const query = useCommandPalette((s) => s.query);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const user = useCurrentUser();
  const { syncNow } = useSyncStatus();

  if (!appConfig.features.sync) return null;

  const signedIn = user.isAuthenticated;
  const label = signedIn ? 'Sync now' : 'Sign in to sync';
  const keywords = signedIn
    ? ['sync', 'now', 'refresh', 'push', 'pull', 'update']
    : ['sync', 'sign in', 'login', 'account'];

  if (!fuzzy(query, `${label} ${keywords.join(' ')}`)) return null;

  const Icon = signedIn ? RefreshCw : LogIn;

  return (
    <CommandGroup heading="Sync">
      <CommandItemPrimitive
        value="sync-action"
        keywords={keywords}
        onSelect={() => {
          if (signedIn) void syncNow();
          else navigate('/sign-in');
          setOpen(false);
        }}
      >
        <Icon className="text-muted-foreground h-4 w-4" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </CommandItemPrimitive>
    </CommandGroup>
  );
}
