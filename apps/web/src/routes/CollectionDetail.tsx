// Per-collection detail page. Renders the collection header (icon /
// title / pin / export / edit / delete + axis toggle), then delegates
// member rendering to <CollectionMembersBoard /> which owns the
// drag-and-drop, group, and ordering UX. Tombstone rows for stale
// entity ids live inside the row component.

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  FolderPlus,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import { Button } from '@scrolled/design';
import {
  CollectionFormDialog,
  downloadJson,
  resolveCollectionColor,
  resolveCollectionIcon,
  slugify,
  todayStamp,
} from '@/components/collections';
import { CollectionMembersBoard } from '@/components/collections/CollectionMembersBoard';
import { CollectionDisplayOptionsMenu } from '@/components/collections/CollectionDisplayOptionsMenu';
import { GroupFormDialog } from '@/components/collections';
import { ConfirmDialog } from '@/components/collections/ConfirmDialog';
import { usePaletteRegistration } from '@/components/command-palette/usePaletteContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient, type EntitySummary } from '@/db';
import {
  useCollection,
  useCollectionGroups,
  useCollectionMembers,
  useDeleteCollection,
  useExportCollectionJson,
  useSetCollectionPinned,
} from '@/hooks/useCollections';
import type { CollectionEntityType, CollectionGroup, CollectionMember } from '@/db/user';
import { COLLECTION_ENTITY_TYPES } from '@/db/user';
import { cn } from '@scrolled/design';

const EMPTY_MEMBERS: readonly CollectionMember[] = [];
const EMPTY_GROUPS: readonly CollectionGroup[] = [];

export default function CollectionDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const navigate = useNavigate();
  const collectionQ = useCollection(Number.isFinite(id) ? id : null);
  const membersQ = useCollectionMembers(Number.isFinite(id) ? id : null);
  const groupsQ = useCollectionGroups(Number.isFinite(id) ? id : null);

  const [editOpen, setEditOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteM = useDeleteCollection();
  const exportM = useExportCollectionJson();
  const pinM = useSetCollectionPinned();

  const members = membersQ.data ?? EMPTY_MEMBERS;
  const groups = groupsQ.data ?? EMPTY_GROUPS;

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
        questChain: new Map(),
        skill: new Map(),
      };
      for (const [t, map] of entries) lookup[t] = map;
      return lookup;
    },
    enabled: members.length > 0,
  });

  const paletteItems = useMemo<CommandItem[]>(() => {
    if (!Number.isFinite(id) || !collectionQ.data) return [];
    return [
      {
        id: 'collection-create-group',
        group: 'context',
        label: 'Create group',
        keywords: ['new', 'group', 'create'],
        icon: FolderPlus,
        onSelect: () => setNewGroupOpen(true),
      },
    ];
  }, [id, collectionQ.data]);

  usePaletteRegistration({ items: paletteItems });
  usePageTitle(collectionQ.data?.name);

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
  const hasMembers = members.length > 0;

  const onDelete = async () => {
    await deleteM.mutateAsync(collection.id);
    navigate('/collections');
  };

  const onExport = async () => {
    const payload = await exportM.mutateAsync(collection.id);
    downloadJson(`${slugify(collection.name)}-${todayStamp()}.json`, payload);
  };

  return (
    <div className="max-w-5xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-[18px]">
            <span
              className={cn(
                'shadow-slot inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-[20px] md:h-24 md:w-24',
                resolveCollectionColor(collection.color).iconBg,
                resolveCollectionColor(collection.color).iconColor,
              )}
            >
              {(() => {
                const { Icon } = resolveCollectionIcon(collection.icon);
                return <Icon className="h-9 w-9 md:h-11 md:w-11" />;
              })()}
            </span>
            <div className="min-w-0 space-y-2">
              <h1 className="font-display break-words text-2xl font-semibold leading-none md:text-4xl">
                {collection.name}
              </h1>
              <p className="text-muted-foreground text-sm">
                {collection.memberCount.toLocaleString()}{' '}
                {collection.memberCount === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(hasMembers || groups.length > 0) && (
              <CollectionDisplayOptionsMenu collection={collection} />
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pinM.mutate({ id: collection.id, pinned: !collection.pinned })}
              disabled={pinM.isPending}
              title={collection.pinned ? 'Unpin from home page' : 'Pin to home page'}
            >
              {collection.pinned ? (
                <PinOff className="h-3.5 w-3.5" />
              ) : (
                <Pin className="h-3.5 w-3.5" />
              )}
              {collection.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button
              variant="secondary"
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
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteOpen(true)}
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

      <ConfirmDialog
        open={deleteOpen}
        title={`Delete the collection "${collection.name}"?`}
        message={`This removes ${collection.memberCount} member(s).`}
        confirmLabel="Delete"
        pending={deleteM.isPending}
        onConfirm={onDelete}
        onClose={() => setDeleteOpen(false)}
      />

      <CollectionFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        collection={collection}
      />

      {membersQ.isPending ? (
        <p className="text-muted-foreground text-sm">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading members…
        </p>
      ) : (
        <>
          {!hasMembers && (
            <div className="border-border bg-card shadow-rim rounded-lg border-2 p-4 text-sm">
              <p className="text-muted-foreground">
                No members yet. Open any item, mob, map, or quest page and click "Save" to add
                one — or set up groups below to organize them as you go.
              </p>
            </div>
          )}
          <CollectionMembersBoard
            collection={collection}
            members={members}
            groups={groups}
            summaries={summariesQ.data}
            onRequestNewGroup={() => setNewGroupOpen(true)}
          />
        </>
      )}

      <GroupFormDialog
        open={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        collectionId={collection.id}
      />
    </div>
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
      <h1 className="font-display mt-4 text-4xl font-semibold">Collection not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This collection may have been deleted. Pick one from the sidebar to continue.
      </p>
    </div>
  );
}
