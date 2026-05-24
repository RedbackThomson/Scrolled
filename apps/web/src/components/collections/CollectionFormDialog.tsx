// Create / rename dialog. Single component covers both flows — pass an
// existing collection to enter rename mode, omit it for create.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useCreateCollection,
  useUpdateCollection,
} from '@/lib/useCollections';
import type { CollectionRecord } from '@/db/user';
import { Modal } from './Modal';

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
  const [error, setError] = useState<string | null>(null);

  // Reset state whenever the dialog opens — otherwise rename of one
  // collection then opening for another would leak state.
  useEffect(() => {
    if (!open) return;
    setName(collection?.name ?? '');
    setDescription(collection?.description ?? '');
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
    // Description preserves internal newlines but trims leading/trailing
    // whitespace so an accidental space doesn't collapse to a non-null
    // empty string on round-trip.
    const trimmedDesc = description.trim();
    const descPatch = trimmedDesc === '' ? null : trimmedDesc;
    try {
      const result = isEdit
        ? await updateM.mutateAsync({
            id: collection!.id,
            patch: { name: trimmedName, description: descPatch },
          })
        : await createM.mutateAsync({ name: trimmedName, description: descPatch });
      onSaved?.(result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

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
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Boss drops to farm"
            className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2"
            autoFocus
          />
        </label>
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
            // Pressing Enter inserts a newline (default textarea behavior);
            // Cmd/Ctrl+Enter submits the form so the user can save without
            // leaving the keyboard.
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </label>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
