// Create / rename dialog. Single component covers both flows — pass an
// existing collection to enter rename mode, omit it for create.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreateCollection, useUpdateCollection } from '@/lib/useCollections';
import type { CollectionRecord } from '@/db/user';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';
import { COLLECTION_ICONS, DEFAULT_COLLECTION_ICON, resolveCollectionIcon } from './iconRegistry';
import {
  COLLECTION_COLORS,
  DEFAULT_COLLECTION_COLOR,
  resolveCollectionColor,
} from './colorRegistry';

interface CollectionFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill for rename. Omit for create. */
  collection?: CollectionRecord | null;
  /** Called with the resulting collection on success (create returns the
   *  new row; rename returns the updated row). */
  onSaved?: (collection: CollectionRecord) => void;
}

export function CollectionFormDialog({
  open,
  onClose,
  collection,
  onSaved,
}: CollectionFormDialogProps) {
  const isEdit = !!collection;
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [iconName, setIconName] = useState<string>(
    collection?.icon ?? DEFAULT_COLLECTION_ICON.name,
  );
  const [colorName, setColorName] = useState<string>(
    collection?.color ?? DEFAULT_COLLECTION_COLOR.name,
  );
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever the dialog opens — otherwise editing one
  // collection then opening another would leak state.
  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? '');
    setDescription(collection?.description ?? '');
    setIconName(collection?.icon ?? DEFAULT_COLLECTION_ICON.name);
    setColorName(collection?.color ?? DEFAULT_COLLECTION_COLOR.name);
    setError(null);
  }, [open, collection]);

  const createM = useCreateCollection();
  const updateM = useUpdateCollection();
  const pending = createM.isPending || updateM.isPending;

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const trimmedDesc = description.trim();
    const descPatch = trimmedDesc === '' ? null : trimmedDesc;
    // Store the neutral default as null so existing rows pre-icon-feature
    // and rows that opt-in to "no color" are indistinguishable from the
    // DB's perspective. resolveCollectionColor handles the null case.
    const iconPatch = iconName === DEFAULT_COLLECTION_ICON.name ? null : iconName;
    const colorPatch = colorName === DEFAULT_COLLECTION_COLOR.name ? null : colorName;
    try {
      const result = isEdit
        ? await updateM.mutateAsync({
            id: collection!.id,
            patch: {
              name: trimmedName,
              description: descPatch,
              icon: iconPatch,
              color: colorPatch,
            },
          })
        : await createM.mutateAsync({
            name: trimmedName,
            description: descPatch,
            icon: iconPatch,
            color: colorPatch,
          });
      onSaved?.(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  const selectedColor = resolveCollectionColor(colorName);
  const selectedIcon = resolveCollectionIcon(iconName);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit collection' : 'New collection'}
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={submit} disabled={pending || !name.trim()}>
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
              selectedColor.iconBg,
              selectedColor.iconColor,
            )}
            aria-hidden
          >
            <selectedIcon.Icon className="h-5 w-5" />
          </div>
          <label className="block min-w-0 flex-1 space-y-1 text-sm">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Boss drops to farm"
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
              autoFocus
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground flex items-center justify-between text-xs uppercase tracking-wide">
            <span>Description</span>
            <span className="text-[10px] normal-case">Optional</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this collection for? (multi-line)"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </label>

        <fieldset className="space-y-1.5">
          <legend className="text-muted-foreground text-xs uppercase tracking-wide">Icon</legend>
          <div className="grid grid-cols-8 gap-1">
            {COLLECTION_ICONS.map((opt) => {
              const active = opt.name === iconName;
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => setIconName(opt.name)}
                  aria-label={opt.label}
                  aria-pressed={active}
                  title={opt.label}
                  className={cn(
                    'border-border flex h-8 w-8 items-center justify-center rounded-md border text-sm transition-colors',
                    active
                      ? 'border-foreground/40 bg-accent text-foreground'
                      : 'hover:bg-accent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <opt.Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-1.5">
          <legend className="text-muted-foreground text-xs uppercase tracking-wide">Color</legend>
          <div className="grid grid-cols-10 gap-1">
            {COLLECTION_COLORS.map((opt) => {
              const active = opt.name === colorName;
              return (
                <button
                  key={opt.name}
                  type="button"
                  onClick={() => setColorName(opt.name)}
                  aria-label={opt.label}
                  aria-pressed={active}
                  title={opt.label}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all',
                    active
                      ? 'border-foreground/60 scale-110'
                      : 'border-transparent hover:scale-105',
                  )}
                >
                  <span className={cn('h-4 w-4 rounded-full', opt.swatch)} aria-hidden />
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
