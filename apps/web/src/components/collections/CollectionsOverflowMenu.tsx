import { useState } from 'react';
import { Download, Loader2, MoreHorizontal, Upload } from 'lucide-react';
import { CollectionsImportDialog } from './CollectionsImportDialog';
import { downloadJson, todayStamp } from './download';
import { useExportAllJson } from '@/hooks/useCollections';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import { usePopover } from '@/hooks/usePopover';

interface Props {
  /** Whether the user has any collections — gates the Export action. */
  hasAny: boolean;
}

/**
 * Demotes Import / Export all to a single overflow trigger so the primary
 * "New collection" CTA stands on its own.
 */
export function CollectionsOverflowMenu({ hasAny }: Props) {
  const [importOpen, setImportOpen] = useState(false);
  const exportAllM = useExportAllJson();
  const { open, setOpen, close, coords, triggerRef, popoverRef } = usePopover();

  const onExportAll = async () => {
    const payload = await exportAllM.mutateAsync();
    downloadJson(`collections-${todayStamp()}.json`, payload);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="More collection actions"
        title="More actions"
        className="border-border bg-card ease-spring inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border-2 shadow-[var(--shadow-btn-secondary)] transition-transform duration-300 hover:-translate-y-0.5 max-md:h-11 max-md:w-11"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <PopoverPanel
          label="More collection actions"
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName="w-52"
          align="right"
          className="p-1.5 max-md:px-3"
        >
          <button
            type="button"
            onClick={() => {
              close();
              setImportOpen(true);
            }}
            className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-semibold max-md:min-h-12"
          >
            <Upload className="h-3.5 w-3.5" />
            Import…
          </button>
          <button
            type="button"
            onClick={onExportAll}
            disabled={!hasAny || exportAllM.isPending}
            title={hasAny ? 'Export all collections as JSON' : 'No collections to export yet'}
            className="hover:bg-muted disabled:hover:bg-transparent flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm font-semibold disabled:opacity-50 max-md:min-h-12"
          >
            {exportAllM.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export all
          </button>
        </PopoverPanel>
      )}
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
