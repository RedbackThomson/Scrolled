import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, cn, Input, SlotTile, Switch } from '@scrolled/design';
import { useCreatePinnedSearch, useUpdatePinnedSearch } from '@/hooks/usePinnedSearches';
import type { PinnedSearchRecord, SavedSearchScope } from '@/db/user';
import { Modal } from '@/components/collections/Modal';
import { FIELD, FIELD_LABEL } from '@/components/collections/fieldStyles';
import { ColorField, IconField } from '@/components/collections/IconColorFields';
import { DEFAULT_COLLECTION_COLOR } from '@/components/collections/colorRegistry';
import { savedSearchLook } from './savedSearchLook';

type SaveSearchDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (search: PinnedSearchRecord) => void;
} & (
  | { scope: SavedSearchScope; params: Record<string, string>; search?: never }
  | { search: PinnedSearchRecord; scope?: never; params?: never }
);

/** Name, icon, colour and Home pin for a new saved search, or for editing one. */
export function SaveSearchDialog({
  open,
  onClose,
  onSaved,
  scope,
  params,
  search,
}: SaveSearchDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(search?.name ?? '');
    setIcon(search?.icon ?? null);
    setColor(search?.color ?? null);
    setPinned(search?.pinned ?? false);
    setError(null);
  }, [open, search]);

  const createM = useCreatePinnedSearch();
  const updateM = useUpdatePinnedSearch();
  const pending = createM.isPending || updateM.isPending;
  const entity = search?.entity ?? scope!;
  const look = savedSearchLook({ icon, color, entity });

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const saved = search
        ? await updateM.mutateAsync({
            id: search.id,
            patch: { name: trimmed, icon, color, pinned },
          })
        : await createM.mutateAsync({
            name: trimmed,
            entity,
            params: params!,
            icon,
            color,
            pinned,
          });
      onSaved?.(saved);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={search ? 'Edit saved search' : 'Save search'}
      description={search ? undefined : 'Keeps the current filters on this page.'}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {search ? 'Save' : 'Save search'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-3">
          <SlotTile icon={look.icon} hue={look.hue} size={48} />
          <label className="block min-w-0 flex-1 space-y-1 text-sm">
            <span className={FIELD_LABEL}>Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this search…"
              className={cn(FIELD, 'h-[38px]')}
              autoFocus
            />
          </label>
        </div>
        <IconField
          value={icon ?? ''}
          onChange={setIcon}
          colorName={color ?? DEFAULT_COLLECTION_COLOR.name}
        />
        <ColorField
          value={color ?? DEFAULT_COLLECTION_COLOR.name}
          onChange={(c) => setColor(c === DEFAULT_COLLECTION_COLOR.name ? null : c)}
        />
        <Switch
          label="Pin to home page"
          description="Show it in Saved searches on Home."
          checked={pinned}
          onChange={setPinned}
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
