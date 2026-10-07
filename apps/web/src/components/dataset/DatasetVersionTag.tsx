// Footer control offering an optional same-revision dataset republish, which it
// downloads and applies in place. An in-flight refresh and auto updates are shown
// by the status row above (DbStatusIndicator), so they aren't duplicated here.
// Renders nothing when up to date or on the generic build.

import { RefreshCw } from 'lucide-react';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';

export function DatasetVersionTag({ collapsed }: { collapsed: boolean }) {
  const { mode, installedVersion, latestVersion, applying, apply } = useDatasetUpdate();
  if (!installedVersion) return null;

  // Optional republish at the same data revision: an actionable amber control.
  if (mode === 'offer') {
    const label = `Update to ${latestVersion}`;
    const title = `A newer dataset (${latestVersion}) is available — update from ${installedVersion}.`;

    if (collapsed) {
      return (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            title={title}
            aria-label={label}
            className="text-amber-600 disabled:opacity-70 dark:text-amber-400"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
      );
    }
    return (
      <div className="px-3.5 py-1.5">
        <button
          type="button"
          onClick={apply}
          disabled={applying}
          title={title}
          className="inline-flex w-full items-center gap-1.5 rounded-full bg-[oklch(0.72_0.12_75/.2)] px-2.5 py-0.5 text-[11.5px] font-bold text-[color:oklch(var(--chip-fg-l)_0.14_75)] transition-opacity hover:opacity-80 disabled:opacity-70"
        >
          <RefreshCw className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </div>
    );
  }

  // Up to date: the version shows in the database status row's tooltip instead.
  return null;
}
