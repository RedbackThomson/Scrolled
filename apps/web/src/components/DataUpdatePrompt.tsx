import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDataState } from '@/hooks/useDataState';

/**
 * Non-blocking nudge shown when the stored library is readable but older than
 * this build's data contract — re-running setup unlocks newer features. Mirrors
 * the PWA UpdatePrompt toast. The blocking "must rebuild" case is handled by a
 * redirect (AppShell#useSetupRedirect), so this only covers the soft
 * case. Dismissal is per-session.
 */
export function DataUpdatePrompt() {
  const { state } = useDataState();
  const [dismissed, setDismissed] = useState(false);

  if (state !== 'update-recommended' || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border p-3 shadow-lg"
    >
      <p className="text-sm">Refresh your library to unlock the latest features.</p>
      <div className="ml-auto flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          Later
        </Button>
        <Link
          to="/setup"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors"
        >
          Run setup
        </Link>
      </div>
    </div>
  );
}
