// Small footer tag, beside the DB health indicator, naming the installed
// hosted-dataset version. When the repository publishes a newer version it
// turns into an amber, clickable control that downloads and applies it in
// place. Renders nothing on the generic build (no installed dataset).

import { Loader2, Package, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';
import { cn } from '@/lib/utils';

export function DatasetVersionTag({ collapsed }: { collapsed: boolean }) {
  const { installedVersion, latestVersion, available, applying, apply } = useDatasetUpdate();
  if (!installedVersion) return null;

  // Newer version published (or mid-update): an actionable amber control.
  if (available || applying) {
    const label = applying ? 'Updating…' : `Update to ${latestVersion}`;
    const title = applying
      ? 'Downloading and installing the newer dataset…'
      : `A newer dataset (${latestVersion}) is available — update from ${installedVersion}.`;
    const Icon = applying ? Loader2 : RefreshCw;

    if (collapsed) {
      return (
        <div className="flex justify-center px-2 pb-2">
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            title={title}
            aria-label={label}
            className="text-amber-600 disabled:opacity-70 dark:text-amber-400"
          >
            <Icon className={cn('h-4 w-4', applying && 'animate-spin')} aria-hidden />
          </button>
        </div>
      );
    }
    return (
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={apply}
          disabled={applying}
          title={title}
          className="inline-flex w-full items-center gap-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-500/25 disabled:opacity-70 dark:text-amber-300"
        >
          <Icon className={cn('h-3 w-3 shrink-0', applying && 'animate-spin')} aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </div>
    );
  }

  // Up to date: a quiet informational tag.
  const title = `Installed dataset version ${installedVersion}`;
  if (collapsed) {
    return (
      <div className="flex justify-center px-2 pb-2" title={title}>
        <Package className="text-sidebar-muted h-4 w-4" aria-label={title} />
      </div>
    );
  }
  return (
    <div className="px-3 pb-2" title={title}>
      <Badge tone="slate" className="gap-1.5">
        <Package className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">Data Version {installedVersion}</span>
      </Badge>
    </div>
  );
}
