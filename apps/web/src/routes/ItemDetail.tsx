import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, ScrollText, Skull } from 'lucide-react';
import { DetailListSection } from '@/components/layout/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/layout/DetailPageLayout';
import { EntityRow } from '@/components/entity-display/EntityRow';
import { ItemIcon } from '@/components/entity-display/ItemIcon';
import { Badge } from '@/components/ui/badge';
import { MetadataFlagBadges } from '@/components/entity-display/MetadataFlagBadges';
import { ITEM_FLAG_ORDER } from '@/components/entity-display/metadataFlags';
import { ListSortControl } from '@/components/common/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import { useListSort } from '@/hooks/useListSort';
import { useShowEntityIds } from '@/stores/showEntityIds';

export default function ItemDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const showIds = useShowEntityIds((s) => s.enabled);

  const itemQ = useQuery({
    queryKey: ['db', 'item', id],
    queryFn: () => client.getItem(id),
    enabled: Number.isFinite(id),
  });
  const questsQ = useQuery({
    queryKey: ['db', 'item', id, 'quests'],
    queryFn: () => client.getItemQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });
  const droppedByQ = useQuery({
    queryKey: ['db', 'item', id, 'dropped-by'],
    queryFn: () => client.getItemDroppedBy(id),
    enabled: Number.isFinite(id) && features.hasMobs,
  });

  const questsSort = useListSort(questsQ.data, [
    { id: 'name', label: 'Quest name', get: (q) => q.name },
  ]);
  const droppedBySort = useListSort(droppedByQ.data, [
    { id: 'name', label: 'Mob name', get: (m) => m.name },
    { id: 'level', label: 'Level', get: (m) => m.level },
  ]);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-item-id',
        group: 'context',
        label: 'Copy item ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'item', id, name: itemQ.data?.name, items: paletteItems });

  if (itemQ.isLoading) return <DetailPageLoading entity="Item" id={id} />;
  if (itemQ.error) {
    return <p className="text-destructive text-sm">{(itemQ.error as Error).message}</p>;
  }
  if (!itemQ.data) return <DetailPageNotFound entity="Item" id={id} />;

  const item = itemQ.data;
  return (
    <DetailPageLayout
      header={
        <header className="flex items-center gap-3">
          <ItemIcon entity="item" id={item.id} size={48} alt={item.name} />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
              {item.name}
            </h1>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              {showIds && <span className="font-mono">{item.id}</span>}
              {item.subcategory && <Badge tone="slate">{item.subcategory}</Badge>}
              <MetadataFlagBadges flags={item} order={ITEM_FLAG_ORDER} />
            </div>
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            {showIds && <InfoRow label="ID" value={String(item.id)} mono />}
            <InfoRow label="Category" value={item.category ?? '—'} />
            {item.subcategory && <InfoRow label="Subcategory" value={item.subcategory} />}
          </InfoSection>
          {(item.price !== null || item.stackSize !== null || item.requiredLevel !== null) && (
            <InfoSection title="Stats">
              {item.price !== null && <InfoRow label="Price" value={item.price.toLocaleString()} />}
              {item.stackSize !== null && <InfoRow label="Stack" value={String(item.stackSize)} />}
              {item.requiredLevel !== null && (
                <InfoRow label="Req. level" value={String(item.requiredLevel)} />
              )}
            </InfoSection>
          )}
          <SourceSection path={item.sourcePath} />
        </>
      }
    >
      <CollectionBadgeStrip entityType="item" entityId={item.id} />

      {item.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed">{item.description}</p>
      ) : (
        <p className="text-muted-foreground text-sm italic">No description available.</p>
      )}

      {features.hasQuests && (
        <DetailListSection
          icon={ScrollText}
          title="Used in quests"
          count={questsQ.data?.length}
          isLoading={questsQ.isLoading}
          isEmpty={questsQ.data?.length === 0}
          loadingLabel="Loading quests…"
          action={
            questsQ.data && questsQ.data.length > 0 ? (
              <ListSortControl
                fields={questsSort.fieldOptions}
                value={questsSort.sort}
                onChange={questsSort.setSort}
              />
            ) : null
          }
        >
          {questsSort.sorted.map((q) => (
            <EntityRow key={q.id} entity="quest" id={q.id} name={q.name} subtitle={q.parent} />
          ))}
        </DetailListSection>
      )}

      {features.hasMobs && (
        <DetailListSection
          icon={Skull}
          title="Dropped by"
          count={droppedByQ.data?.length}
          isLoading={droppedByQ.isLoading}
          isEmpty={droppedByQ.data?.length === 0}
          loadingLabel="Loading mobs…"
          action={
            droppedByQ.data && droppedByQ.data.length > 0 ? (
              <ListSortControl
                fields={droppedBySort.fieldOptions}
                value={droppedBySort.sort}
                onChange={droppedBySort.setSort}
              />
            ) : null
          }
        >
          {droppedBySort.sorted.map((m) => (
            <EntityRow
              key={m.mobId}
              entity="mob"
              id={m.mobId}
              name={m.name}
              meta={m.level !== null ? `Lvl ${m.level}` : undefined}
            />
          ))}
        </DetailListSection>
      )}
    </DetailPageLayout>
  );
}
