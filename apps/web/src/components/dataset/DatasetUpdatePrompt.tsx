// Non-blocking nudge shown on a fixed-dataset deployment when a newer dataset
// version is published. Distinct from the PWA `UpdatePrompt` (which updates the
// app itself) in both copy and placement — it stacks above it so both can show.

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';

export function DatasetUpdatePrompt() {
  const { available, displayName, applying, error, apply } = useDatasetUpdate();
  const [dismissed, setDismissed] = useState(false);

  if (!available || dismissed) return null;

  const name = displayName ?? 'dataset';

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background fixed bottom-20 right-4 z-50 flex max-w-sm items-center gap-3 rounded-md border p-3 shadow-lg"
    >
      <div className="min-w-0">
        <p className="text-sm">A newer {name} dataset is available.</p>
        {error && <p className="text-destructive mt-1 text-xs">{error.message}</p>}
      </div>
      <div className="ml-auto flex shrink-0 gap-2">
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} disabled={applying}>
          Later
        </Button>
        <Button size="sm" onClick={apply} disabled={applying}>
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
        </Button>
      </div>
    </div>
  );
}
