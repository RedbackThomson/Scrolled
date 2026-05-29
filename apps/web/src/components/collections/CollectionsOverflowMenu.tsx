import { useState } from 'react';
import { Download, Loader2, MoreHorizontal, Upload } from 'lucide-react';
import { CollectionsImportDialog } from './CollectionsImportDialog';
import { downloadJson, todayStamp } from './download';
import { useExportAllJson } from '@/hooks/useCollections';

interface Props {
  /** Whether the user has any collections — gates the Export action. */
  hasAny: boolean;
}

/**
 * Demotes Import / Export all to a single overflow trigger so the primary
 * "New collection" CTA stands on its own. Matches the `<details>`-based
 * dropdown pattern used by ColumnVisibility — no portal, no outside-click
 * handler, just native disclosure.
 */
export function CollectionsOverflowMenu({ hasAny }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const exportAllM = useExportAllJson();

  const onExportAll = async () => {
    const payload = await exportAllM.mutateAsync();
    downloadJson(`collections-${todayStamp()}.json`, payload);
  };

  return (
    <>
      <details className="relative">
        <summary
          aria-label="More collection actions"
          title="More actions"
          className="border-input bg-background hover:bg-accent inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border"
          // Prevent the disclosure marker on browsers that ignore list-style:none on summary.
          style={{ listStyle: 'none' }}
        >
          <MoreHorizontal className="h-4 w-4" />
        </summary>
        <div className="border-border bg-card text-card-foreground absolute right-0 z-20 mt-1 w-48 rounded-md border p-1 shadow-md">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="hover:bg-accent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
          >
            <Upload className="h-3.5 w-3.5" />
            Import…
          </button>
          <button
            type="button"
            onClick={onExportAll}
            disabled={!hasAny || exportAllM.isPending}
            title={hasAny ? 'Export all collections as JSON' : 'No collections to export yet'}
            className="hover:bg-accent disabled:hover:bg-transparent flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm disabled:opacity-50"
          >
            {exportAllM.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export all
          </button>
        </div>
      </details>
      <CollectionsImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      {exportAllM.isError && (
        <p
          role="alert"
          className="text-destructive basis-full text-xs"
        >
          Export failed: {(exportAllM.error as Error).message}
        </p>
      )}
    </>
  );
}
