// Create / rename dialog. Single component covers both flows — pass an
// existing collection to enter rename mode, omit it for create.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input, Textarea } from '@scrolled/design';
import { useCreateCollection, useUpdateCollection } from '@/hooks/useCollections';
import type { CollectionRecord } from '@/db/user';
import { cn } from '@scrolled/design';
import { Modal } from './Modal';
import { FIELD, FIELD_LABEL } from './fieldStyles';
import { DEFAULT_COLLECTION_ICON, resolveCollectionIcon } from './iconRegistry';
import { ColorField, IconField } from './IconColorFields';
import { DEFAULT_COLLECTION_COLOR, resolveCollectionColor } from './colorRegistry';

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
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={pending}>
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
              'shadow-slot flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]',
              selectedColor.iconBg,
              selectedColor.iconColor,
            )}
            aria-hidden
          >
            <selectedIcon.Icon className="h-6 w-6" />
          </div>
          <label className="block min-w-0 flex-1 space-y-1 text-sm">
            <span className={FIELD_LABEL}>Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Boss drops to farm"
              className={cn(FIELD, 'h-[38px]')}
              autoFocus
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className={cn(FIELD_LABEL, 'flex items-center justify-between')}>
            <span>Description</span>
            <span className="font-sans text-[11.5px] font-medium">Optional</span>
          </span>
          <Textarea
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
            className={cn(FIELD, 'resize-y py-2')}
          />
        </label>

        <IconField value={iconName} onChange={setIconName} colorName={colorName} />
        <ColorField value={colorName} onChange={setColorName} />

        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
