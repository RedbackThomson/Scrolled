// Per-collection detail page. Shows every member grouped by entity type,
// with a tombstone row for any member whose underlying entity isn't
// loaded into the game DB (e.g. user re-imported a different WZ set,
// leaving stale ids behind).

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CollectionFormDialog,
  downloadJson,
  resolveCollectionColor,
  resolveCollectionIcon,
  slugify,
  todayStamp,
} from '@/components/collections';
import { MemberRow } from '@/components/collections/MemberRow';
import { getDbClient, type EntitySummary } from '@/db';
import {
  useCollection,
  useCollectionMembers,
  useDeleteCollection,
  useExportCollectionJson,
} from '@/hooks/useCollections';
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
