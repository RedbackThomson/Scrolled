// Create-group dialog. Replaces the browser prompt the "New group" button and
// the command-palette action used, matching the app's other dialogs.

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, Input } from '@scrolled/ui';
import { useCreateGroup } from '@/hooks/useCollections';
import type { CollectionGroup } from '@/db/user';
import { Modal } from './Modal';

interface NewGroupDialogProps {
  open: boolean;
  onClose: () => void;
  collectionId: number;
  /** Existing groups, used to reject a duplicate name before hitting the DB. */
  existingGroups: readonly CollectionGroup[];
  onCreated?: (group: CollectionGroup) => void;
}

export function NewGroupDialog({
  open,
  onClose,
  collectionId,
  existingGroups,
  onCreated,
}: NewGroupDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createM = useCreateGroup();

  useEffect(() => {
    if (!open) return;
    setName('');
    setError(null);
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }
    if (existingGroups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A group with that name already exists.');
      return;
    }
    try {
      const group = await createM.mutateAsync({ collectionId, name: trimmed });
      onCreated?.(group);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the group.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createM.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={createM.isPending || !name.trim()}
          >
            {createM.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Create
          </Button>
        </>
      }
    >
      <form
        className="space-y-1"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">Name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Daily bosses"
            className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-sm"
            autoFocus
          />
        </label>
        {error && <p className="text-destructive text-xs">{error}</p>}
      </form>
    </Modal>
  );
}
