import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { BottomSheet, Button, SlotTile, Switch, TextField } from '@scrolled/design';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useCreatePinnedSearch, useUpdatePinnedSearch } from '@/hooks/usePinnedSearches';
import type { PinnedSearchRecord, SavedSearchScope } from '@/db/user';
import { Modal } from '@/components/collections/Modal';
import { ColorField, IconField } from '@/components/collections/IconColorFields';
import { DEFAULT_COLLECTION_COLOR } from '@/components/collections/colorRegistry';
import { savedSearchLook } from './savedSearchLook';

type SaveSearchDialogProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (search: PinnedSearchRecord) => void;
  /** What's being saved, shown at the top of the phone sheet */
  summary?: {
    count: number;
    chips: readonly { id: string; label: string; value: string; hue: number }[];
  };
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
  summary,
}: SaveSearchDialogProps) {
  const isMobile = useIsMobile();
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

  const title = search ? 'Edit saved search' : 'Save search';
  const form = (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center gap-3">
        <SlotTile icon={look.icon} hue={look.hue} size={48} />
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this search…"
          size={isMobile ? 'lg' : 'md'}
          className="flex-1"
          autoFocus
        />
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
  );

  if (isMobile) {
    if (!open) return null;
    return createPortal(
      <BottomSheet
        label={title}
        onDismiss={onClose}
        top={110}
        footer={
          <Button
            className="h-12 w-full rounded-2xl"
            onClick={submit}
            disabled={pending || !name.trim()}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {search ? 'Save' : 'Save search'}
          </Button>
        }
      >
        <div className="space-y-3 px-4 pb-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[22px] font-semibold">{title}</h2>
            {summary && (
              <span className="text-muted-foreground text-[13px]">
                {summary.count.toLocaleString()} {summary.count === 1 ? 'result' : 'results'}
              </span>
            )}
          </div>
          {summary && summary.chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {summary.chips.map((c) => (
                <span
                  key={c.id}
                  className="bg-card inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-0.5 text-[12.5px]"
                  style={{ borderColor: `oklch(0.7 0.12 ${c.hue} / .6)` }}
                >
                  <span className="text-muted-foreground font-semibold">{c.label}</span>
                  <b>{c.value}</b>
                </span>
              ))}
            </div>
          )}
          {form}
        </div>
      </BottomSheet>,
      document.body,
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
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
      {form}
    </Modal>
  );
}
