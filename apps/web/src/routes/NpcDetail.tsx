import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Map as MapIcon, MapPin, ScrollText, Users } from 'lucide-react';
import { DetailListSection } from '@/components/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/DetailPageLayout';
import { EntityIcon } from '@/components/EntityIcon';
import { EntityRow } from '@/components/EntityRow';
import { ListSortControl } from '@/components/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import { useListSort } from '@/hooks/useListSort';

const BACK = { to: '/npcs', label: 'Back to NPCs' };

export default function NpcDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const npcQ = useQuery({
    queryKey: ['db', 'npc', id],
    queryFn: () => client.getNpc(id),
    enabled: Number.isFinite(id),
  });
  const mapsQ = useQuery({
    queryKey: ['db', 'npc', id, 'maps'],
    queryFn: () => client.getNpcMaps(id),
    enabled: Number.isFinite(id) && features.hasMaps,
  });
  const questsQ = useQuery({
    queryKey: ['db', 'npc', id, 'quests'],
    queryFn: () => client.getNpcQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });

  const questsSort = useListSort(questsQ.data, [
    { id: 'name', label: 'Quest name', get: (q) => q.name },
  ]);
  const mapsSort = useListSort(mapsQ.data, [
    { id: 'name', label: 'Map name', get: (m) => m.name },
    { id: 'street', label: 'Street', get: (m) => m.streetName },
  ]);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-npc-id',
        group: 'context',
        label: 'Copy NPC ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'npc', id, name: npcQ.data?.name, items: paletteItems });

  if (npcQ.isLoading) return <DetailPageLoading entity="NPC" id={id} />;
  if (!npcQ.data) return <DetailPageNotFound entity="NPC" id={id} back={BACK} />;

  const n = npcQ.data;
  return (
    <DetailPageLayout
      back={BACK}
      header={
        <header className="flex items-center gap-3">
          <EntityIcon entity="npc" id={n.id} size={96} placeholder={Users} alt={n.name} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{n.name}</h1>
            <p className="text-muted-foreground font-mono text-xs">{n.id}</p>
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            <InfoRow label="ID" value={n.id} mono />
          </InfoSection>
          <SourceSection path={n.sourcePath} />
        </>
      }
    >
      <CollectionBadgeStrip entityType="npc" entityId={n.id} />

      {n.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed">{n.description}</p>
      ) : (
        <p className="text-muted-foreground text-sm italic">No description.</p>
      )}

      {features.hasQuests && (
        <DetailListSection
          icon={ScrollText}
          title="Quests"
          count={questsQ.data?.length}
          isEmpty={questsQ.data?.length === 0}
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

      {features.hasMaps && (
        <DetailListSection
          icon={MapIcon}
          title="Appears on"
          count={mapsQ.data?.length}
          isLoading={mapsQ.isLoading}
          isEmpty={mapsQ.data?.length === 0}
          loadingLabel="Loading maps…"
          action={
            mapsQ.data && mapsQ.data.length > 0 ? (
              <ListSortControl
                fields={mapsSort.fieldOptions}
                value={mapsSort.sort}
                onChange={mapsSort.setSort}
              />
            ) : null
          }
        >
          {mapsSort.sorted.map((m) => (
            <EntityRow
              key={m.id}
              entity="map"
              id={m.id}
              name={m.name}
              subtitle={m.streetName}
              trailing={
                m.minimapPath && (
                  <Link
                    to={`/maps/${m.id}?viewer=npc:${n.id}`}
                    aria-label={`Show ${n.name} on ${m.name ?? `Map ${m.id}`}`}
                    title="Show on map"
                    className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-primary/60 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover:opacity-100"
                  >
                    <MapPin className="h-4 w-4" />
                  </Link>
                )
              }
            />
          ))}
        </DetailListSection>
      )}
    </DetailPageLayout>
  );
}
