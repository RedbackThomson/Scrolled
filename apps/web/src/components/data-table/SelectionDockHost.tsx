import { useState } from 'react';
import { SelectionDock } from '@scrolled/design';
import type { CollectionEntityType, CollectionGroup, CollectionRecord, EntityRef } from '@/db/user';
import { usePopover } from '@/hooks/usePopover';
import { useBulkAddMembers, useRemovePlacements } from '@/hooks/useCollections';
import { showToast } from '@/stores/toasts';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import { CollectionDestinationPicker } from '@/components/collections/CollectionDestinationPicker';
import { CollectionFormDialog } from '@/components/collections/CollectionFormDialog';
import { CollectionDestinationSheet } from '@/components/collections/CollectionDestinationSheet';
import type { RowSelection } from './useRowSelection';

interface SelectionDockHostProps {
  selection: RowSelection;
  entity: CollectionEntityType;
  /** Rows matching the filters */
  total: number;
  /** Every matching id, for "select all" */
  resolveAll: () => Promise<string[]>;
  /** Phone layout: a full-width dock and a collection sheet */
  mobile?: boolean;
}

/** The floating selection bar and its add-to-collection flow, with Undo. */
export function SelectionDockHost({
  selection,
  entity,
  total,
  resolveAll,
  mobile,
}: SelectionDockHostProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { open, close, openAt, coords, popoverRef } = usePopover<HTMLButtonElement, HTMLDivElement>(
    { gap: 10, placement: 'above' },
  );
  const [creating, setCreating] = useState(false);
  const bulkM = useBulkAddMembers();
  const undoM = useRemovePlacements();
  const count = selection.allMatching ? total : selection.ids.size;

  const add = async (collection: CollectionRecord, group: CollectionGroup | null) => {
    const ids = selection.allMatching ? await resolveAll() : [...selection.ids];
    const refs: EntityRef[] = ids
      .map((id) => ({ entityType: entity, entityId: Number(id) }))
      .filter((r) => Number.isFinite(r.entityId));
    const groupId = group?.id ?? null;
    const result = await bulkM.mutateAsync({ collectionId: collection.id, refs, groupId });
    close();
    setSheetOpen(false);
    selection.clear();
    const where = group ? `${collection.name} › ${group.name}` : collection.name;
    showToast({
      message:
        result.added === 0
          ? `All ${result.skipped.toLocaleString()} were already in ${where}`
          : `Added ${result.added.toLocaleString()} to ${where}` +
            (result.skipped > 0
              ? ` · ${result.skipped.toLocaleString()} ${result.skipped === 1 ? 'was' : 'were'} already there`
              : ''),
      action:
        result.added > 0
          ? {
              label: 'Undo',
              run: () =>
                undoM.mutate({ collectionId: collection.id, refs: result.addedRefs, groupId }),
            }
          : undefined,
    });
  };

  return (
    <>
      <SelectionDock
        count={count}
        total={total}
        allMatching={selection.allMatching}
        onSelectAll={selection.selectAllMatching}
        onAdd={(anchor) => (mobile ? setSheetOpen(true) : open ? close() : openAt(anchor))}
        addOpen={mobile ? sheetOpen : open}
        onClear={selection.clear}
        variant={mobile ? 'mobile' : 'desktop'}
      />
      {mobile && sheetOpen && count > 0 && (
        <CollectionDestinationSheet
          count={count}
          entity={entity}
          previewIds={[...selection.ids].slice(0, 3).map(Number)}
          pending={bulkM.isPending}
          onAdd={(c, g) => void add(c, g)}
          onNewCollection={() => {
            setSheetOpen(false);
            setCreating(true);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
      {!mobile && open && count > 0 && (
        <PopoverPanel
          label="Add to collection"
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName="w-80"
          className="overflow-hidden"
        >
          <CollectionDestinationPicker
            count={count}
            pending={bulkM.isPending}
            onPick={(c, g) => void add(c, g)}
            onNewCollection={() => {
              close();
              setCreating(true);
            }}
          />
        </PopoverPanel>
      )}
      <CollectionFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => void add(c, null)}
      />
    </>
  );
}
