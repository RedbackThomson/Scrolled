import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { EntityLink } from '@/components/entity-links';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { useRemoveMember, useUpdateMember } from '@/hooks/useCollections';
import type { CollectionMember } from '@/db/user';
import { cn } from '@/lib/utils';

interface MemberRowProps {
  member: CollectionMember;
  name: string | null;
}

export function MemberRow({ member, name }: MemberRowProps) {
  const updateM = useUpdateMember();
  const removeM = useRemoveMember();
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(member.note ?? '');
  const [qtyDraft, setQtyDraft] = useState<string>(
    member.quantity == null ? '' : String(member.quantity),
  );

  // Re-sync drafts whenever the server-side row changes (e.g. another
  // surface edited the same membership).
  useEffect(() => {
    setQtyDraft(member.quantity == null ? '' : String(member.quantity));
  }, [member.quantity]);
  useEffect(() => {
    if (!editingNote) setNoteDraft(member.note ?? '');
  }, [member.note, editingNote]);

  const isTombstone = name === null;

  const commitNote = async () => {
    const next = noteDraft.trim();
    if ((next || null) === (member.note ?? null)) {
      setEditingNote(false);
      return;
    }
    await updateM.mutateAsync({
      collectionId: member.collectionId,
      entityType: member.entityType,
      entityId: member.entityId,
      patch: { note: next || null },
    });
    setEditingNote(false);
  };

  const commitQty = () => {
    const trimmed = qtyDraft.trim();
    let next: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setQtyDraft(member.quantity == null ? '' : String(member.quantity));
        return;
      }
      next = Math.floor(n);
    }
    if (next === (member.quantity ?? null)) return;
    updateM.mutate({
      collectionId: member.collectionId,
      entityType: member.entityType,
      entityId: member.entityId,
      patch: { quantity: next },
    });
  };

  const toggleDone = async () => {
    await updateM.mutateAsync({
      collectionId: member.collectionId,
      entityType: member.entityType,
      entityId: member.entityId,
      patch: { done: !member.done },
    });
  };

  const onRemove = async () => {
    await removeM.mutateAsync({
      collectionId: member.collectionId,
      entityType: member.entityType,
      entityId: member.entityId,
    });
  };

  const linkClass = 'flex min-w-0 items-center gap-3';
  const nameContent = (
    <span className={cn('min-w-0 truncate', member.done && 'text-muted-foreground line-through')}>
      {name}
    </span>
  );

  return (
    <li
      className={cn(
        'group flex flex-wrap items-center gap-3 px-3 py-1.5 text-sm',
        !isTombstone && 'hover:bg-accent',
      )}
    >
      <button
        type="button"
        onClick={toggleDone}
        aria-label={member.done ? 'Mark as not done' : 'Mark as done'}
        title={member.done ? 'Done' : 'Mark as done'}
        className={cn(
          'border-input flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
          member.done && 'bg-primary border-primary text-primary-foreground',
        )}
      >
        {member.done && <Check className="h-3 w-3" />}
      </button>

      {isTombstone ? (
        <div className={linkClass}>
          <EntityAvatar entity={member.entityType} id={member.entityId} />
          <span className="text-muted-foreground min-w-0 truncate italic">
            {capitalize(member.entityType)} #{member.entityId}
            <span className="ml-1 text-[10px] uppercase tracking-wide">(not loaded)</span>
          </span>
        </div>
      ) : (
        <EntityLink
          entity={member.entityType}
          id={member.entityId}
          className={linkClass}
          triggerClassName={linkClass}
        >
          <EntityAvatar entity={member.entityType} id={member.entityId} alt={name!} />
          {nameContent}
        </EntityLink>
      )}

      <div className="ml-auto flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
        {editingNote ? (
          <input
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={commitNote}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitNote();
              } else if (e.key === 'Escape') {
                setNoteDraft(member.note ?? '');
                setEditingNote(false);
              }
            }}
            autoFocus
            placeholder="Add a note…"
            className="border-input bg-background focus-visible:ring-ring h-7 min-w-0 flex-1 rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNoteDraft(member.note ?? '');
              setEditingNote(true);
            }}
            className={cn(
              'min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-left text-xs',
              member.note
                ? 'text-foreground hover:bg-accent'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {member.note ? member.note : 'Add note…'}
          </button>
        )}
        <label className="inline-flex shrink-0 items-center gap-1">
          <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Qty</span>
          <input
            type="number"
            min={0}
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            onBlur={commitQty}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setQtyDraft(member.quantity == null ? '' : String(member.quantity));
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="—"
            aria-label="Target quantity"
            className="border-input bg-background focus-visible:ring-ring h-7 w-16 rounded-md border px-2 text-xs tabular-nums focus-visible:outline-none focus-visible:ring-2"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={removeM.isPending}
        aria-label="Remove from collection"
        title="Remove from collection"
        className="text-muted-foreground hover:text-destructive inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
