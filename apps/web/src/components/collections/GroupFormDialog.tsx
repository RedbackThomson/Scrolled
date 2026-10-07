// Create / edit dialog for a collection group. Pass a group to edit it, omit
// for create. Matches CollectionFormDialog: name plus a multi-line description.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, TextArea, TextField } from '@scrolled/design';
import { useCreateGroup, useUpdateGroup } from '@/hooks/useCollections';
import type { CollectionGroup } from '@/db/user';
import { Modal } from './Modal';

interface GroupFormDialogProps {
  open: boolean;
  onClose: () => void;
  collectionId: number;
  /** Pre-fill for edit. Omit for create. */
  group?: CollectionGroup | null;
  onSaved?: (group: CollectionGroup) => void;
}

export function GroupFormDialog({
  open,
  onClose,
  collectionId,
  group,
  onSaved,
}: GroupFormDialogProps) {
  const isEdit = !!group;
  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const createM = useCreateGroup();
  const updateM = useUpdateGroup();
  const pending = createM.isPending || updateM.isPending;

  // Reset whenever the dialog opens — otherwise editing one group then opening
  // another would leak state.
  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? '');
    setDescription(group?.description ?? '');
    setError(null);
  }, [open, group]);

  const submit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const descPatch = description.trim() === '' ? null : description.trim();
    try {
      const result =
        isEdit && group
          ? await updateM.mutateAsync({
              groupId: group.id,
              patch: { name: trimmedName, description: descPatch },
            })
          : await createM.mutateAsync({
              collectionId,
              name: trimmedName,
              description: descPatch,
            });
      onSaved?.(result);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(
        /unique/i.test(message)
          ? 'A group with that name already exists.'
          : message || 'Save failed.',
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit group' : 'New group'}
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
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily bosses"
          autoFocus
        />
        <TextArea
          label="Description"
          hint="Optional"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What belongs in this group? (multi-line)"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
