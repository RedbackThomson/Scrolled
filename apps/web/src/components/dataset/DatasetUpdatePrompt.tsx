// Surfaces a fixed-dataset deployment's pending dataset update. Two shapes,
// chosen by `mode` (see useDatasetUpdate):
//   - `auto`: this build expects newer data than is installed (a data-revision
//     gap created by the app update). Applied automatically so updating the app
//     also unlocks its new data — shown as a non-dismissible "Updating…" status,
//     degrading to a manual retry only if the background refresh fails.
//   - `offer`: an optional same-revision republish — a dismissible one-click nudge.
// Distinct from the PWA `UpdatePrompt` (which updates the app itself) in both
// copy and placement — it stacks above it so both can show.

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';
import { isAppUpdateRequired } from '@/hooks/dataset/errors';

export function DatasetUpdatePrompt() {
  const { mode, displayName, applying, error, apply } = useDatasetUpdate();
  const [dismissed, setDismissed] = useState(false);

  // Auto mode fires the refresh once, without waiting for a click — it's the
  // tail end of the app update. A failure stops the auto-retry and falls back to
  // the manual button below; the ref keeps a re-render from re-triggering it.
  const autoTriggered = useRef(false);
  useEffect(() => {
    if (mode === 'auto' && !autoTriggered.current && !applying && !error) {
      autoTriggered.current = true;
      apply();
    }
  }, [mode, applying, error, apply]);

  if (mode === 'none') return null;
  const auto = mode === 'auto';
  // Auto mode with no error yet: a silent background refresh, no buttons.
  const refreshing = auto && !error;
  // Only an in-progress auto refresh is non-dismissible; an optional offer or a
  // failed auto update (data still readable) can be put off.
  if (dismissed && !refreshing) return null;

  const name = displayName ?? 'dataset';
  // The newer dataset needs a newer app; applying would just re-fail. The PWA
  // update prompt (also mounted in AppShell) is how the user gets the new app.
  const needsAppUpdate = isAppUpdateRequired(error);

  let message: string;
  if (needsAppUpdate) {
    message = `A newer ${name} dataset needs an app update first.`;
  } else if (refreshing) {
    message = `Updating ${name} data…`;
  } else if (auto) {
    message = `Couldn't finish updating the ${name} data.`;
  } else {
    message = `A newer ${name} dataset is available.`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background fixed bottom-20 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border p-3 shadow-lg"
    >
      {refreshing && <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" aria-hidden />}
      <div className="min-w-0">
        <p className="text-sm">{message}</p>
        {error && <p className="text-destructive mt-1 text-xs">{error.message}</p>}
      </div>
      {!refreshing && (
        <div className="ml-auto flex shrink-0 gap-2">
          {/* Auto-update failures are still optional to retry now — the data
              remains readable — so both shapes offer a "Later". */}
          <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} disabled={applying}>
            Later
          </Button>
          {!needsAppUpdate && (
            <Button size="sm" onClick={apply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : auto ? 'Try again' : 'Update'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
