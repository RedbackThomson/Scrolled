// Per-collection detail page. Shows every member grouped by entity type,
// with a tombstone row for any member whose underlying entity isn't
// loaded into the game DB (e.g. user re-imported a different WZ set,
// leaving stale ids behind).

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Download, Loader2, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CollectionFormDialog,
  downloadJson,
  resolveCollectionColor,
  resolveCollectionIcon,
  slugify,
  todayStamp,
} from '@/components/collections';
import { EntityLink } from '@/components/entity-links';
import { EntityAvatar } from '@/components/EntityAvatar';
import { getDbClient, type EntitySummary } from '@/db';
import {
  useCollection,
  useCollectionMembers,
  useDeleteCollection,
  useExportCollectionJson,
  useRemoveMember,
  useUpdateMember,
} from '@/lib/useCollections';
import type { CollectionEntityType, CollectionMember } from '@/db/user';
import { COLLECTION_ENTITY_TYPES } from '@/db/user';
import { cn } from '@/lib/utils';

const EMPTY_MEMBERS: readonly CollectionMember[] = [];

const TYPE_LABELS: Record<CollectionEntityType, string> = {
  item: 'Items',
  equip: 'Equips',
  mob: 'Mobs',
  npc: 'NPCs',
  map: 'Maps',
  quest: 'Quests',
};

export default function CollectionDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();
  const collectionQ = useCollection(Number.isFinite(id) ? id : null);
  const membersQ = useCollectionMembers(Number.isFinite(id) ? id : null);

  const [editOpen, setEditOpen] = useState(false);
  const deleteM = useDeleteCollection();
  const exportM = useExportCollectionJson();

  const members = membersQ.data ?? EMPTY_MEMBERS;

  // Group member ids by entity type so we can fan out one batch lookup
  // per type. Re-keyed only when the set of ids changes.
  const idsByType = useMemo(() => {
    const out: Partial<Record<CollectionEntityType, number[]>> = {};
    for (const m of members) {
      const list = out[m.entityType] ?? [];
      list.push(m.entityId);
      out[m.entityType] = list;
    }
    return out;
  }, [members]);

  const summariesKey = useMemo(
    () =>
      COLLECTION_ENTITY_TYPES.map((t) => {
        const ids = idsByType[t];
        return ids
          ? `${t}:${ids
              .slice()
              .sort((a, b) => a - b)
              .join(',')}`
          : '';
      }).join('|'),
    [idsByType],
  );

  const summariesQ = useQuery({
    queryKey: ['user', 'collections', 'summaries', summariesKey],
    queryFn: async () => {
      const db = getDbClient();
      const entries = await Promise.all(
        COLLECTION_ENTITY_TYPES.map(async (t) => {
          const ids = idsByType[t];
          if (!ids || ids.length === 0) return [t, new Map<number, string>()] as const;
          const rows: EntitySummary[] = await db.getEntitySummariesByIds(t, ids);
          const map = new Map<number, string>();
          for (const r of rows) map.set(r.id, r.name);
          return [t, map] as const;
        }),
      );
      const lookup: Record<CollectionEntityType, Map<number, string>> = {
        item: new Map(),
        equip: new Map(),
        mob: new Map(),
        npc: new Map(),
        map: new Map(),
        quest: new Map(),
      };
      for (const [t, map] of entries) lookup[t] = map;
      return lookup;
    },
    enabled: members.length > 0,
  });

  if (!Number.isFinite(id)) {
    return <NotFound />;
  }

  if (collectionQ.isPending) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading collection…
      </p>
    );
  }
  if (!collectionQ.data) {
    return <NotFound />;
  }

  const collection = collectionQ.data;

  const grouped: { type: CollectionEntityType; items: CollectionMember[] }[] =
    COLLECTION_ENTITY_TYPES.map((t) => ({
      type: t,
      items: members.filter((m) => m.entityType === t),
    })).filter((g) => g.items.length > 0);

  const onDelete = async () => {
    if (
      !confirm(
        `Delete the collection "${collection.name}"? This removes ${collection.memberCount} member(s).`,
      )
    )
      return;
    await deleteM.mutateAsync(collection.id);
    navigate('/collections');
  };

  const onExport = async () => {
    const payload = await exportM.mutateAsync(collection.id);
    downloadJson(`${slugify(collection.name)}-${todayStamp()}.json`, payload);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <Link
        to="/collections"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to collections
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'inline-flex h-12 w-12 items-center justify-center rounded-md',
                resolveCollectionColor(collection.color).iconBg,
                resolveCollectionColor(collection.color).iconColor,
              )}
            >
              {(() => {
                const { Icon } = resolveCollectionIcon(collection.icon);
                return <Icon className="h-6 w-6" />;
              })()}
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{collection.name}</h1>
              <p className="text-muted-foreground text-sm">
                {collection.memberCount.toLocaleString()}{' '}
                {collection.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              disabled={exportM.isPending}
              title="Export this collection as JSON"
            >
              {exportM.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={deleteM.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
        {collection.description && (
          <p className="text-muted-foreground max-w-2xl whitespace-pre-line text-sm leading-relaxed">
            {collection.description}
          </p>
        )}
      </header>

      <CollectionFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        collection={collection}
      />

      {membersQ.isPending ? (
        <p className="text-muted-foreground text-sm">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading members…
        </p>
      ) : grouped.length === 0 ? (
        <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
          <p className="text-muted-foreground">
            No members yet. Open any item, mob, map, or quest page and click "Save".
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.type} className="space-y-2">
              <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                {TYPE_LABELS[group.type]} ({group.items.length})
              </h2>
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {group.items.map((m) => (
                  <MemberRow
                    key={`${m.entityType}-${m.entityId}`}
                    member={m}
                    name={summariesQ.data?.[m.entityType]?.get(m.entityId) ?? null}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

interface MemberRowProps {
  member: CollectionMember;
  name: string | null;
}

function MemberRow({ member, name }: MemberRowProps) {
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

function NotFound() {
  return (
    <div className="max-w-3xl">
      <Link
        to="/collections"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to collections
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Collection not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This collection may have been deleted. Pick one from the sidebar to continue.
      </p>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
