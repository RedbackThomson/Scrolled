import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Crown, Map as MapIcon, MapPin, Package, ScrollText, Skull } from 'lucide-react';
import { DetailListSection } from '@/components/layout/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/layout/DetailPageLayout';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { EntityRow } from '@/components/entity-display/EntityRow';
import { ExpValue } from '@/components/entity-display/ExpValue';
import { ListSortControl } from '@/components/common/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import { useListSort } from '@/hooks/useListSort';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { MobElementsSection } from '@/components/entity-display/MobElementsSection';

const BACK = { to: '/mobs', label: 'Back to mobs' };

export default function MobDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const showIds = useShowEntityIds((s) => s.enabled);

  const mobQ = useQuery({
    queryKey: ['db', 'mob', id],
    queryFn: () => client.getMob(id),
    enabled: Number.isFinite(id),
  });
  const questsQ = useQuery({
    queryKey: ['db', 'mob', id, 'quests'],
    queryFn: () => client.getMobQuests(id),
    enabled: Number.isFinite(id) && features.hasQuests,
  });
  const dropsQ = useQuery({
    queryKey: ['db', 'mob', id, 'drops'],
    queryFn: () => client.getMobDrops(id),
    enabled: Number.isFinite(id),
  });
  const mapsQ = useQuery({
    queryKey: ['db', 'mob', id, 'maps'],
    queryFn: () => client.getMobMaps(id),
    enabled: Number.isFinite(id) && features.hasMaps,
  });

  const dropSort = useListSort(dropsQ.data, [
    { id: 'name', label: 'Name', get: (d) => d.itemName },
    { id: 'id', label: 'Item ID', get: (d) => d.itemId },
  ]);
  const mapsSort = useListSort(mapsQ.data, [
    { id: 'name', label: 'Map name', get: (m) => m.name },
    { id: 'street', label: 'Street', get: (m) => m.streetName },
    { id: 'spawns', label: 'Spawns', get: (m) => m.spawnCount },
  ]);
  const questsSort = useListSort(questsQ.data, [
    { id: 'name', label: 'Quest name', get: (q) => q.name },
  ]);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-mob-id',
        group: 'context',
        label: 'Copy mob ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'mob', id, name: mobQ.data?.name, items: paletteItems });

  if (mobQ.isLoading) return <DetailPageLoading entity="Mob" id={id} />;
  if (mobQ.error) {
    return <p className="text-destructive text-sm">{(mobQ.error as Error).message}</p>;
  }
  if (!mobQ.data) return <DetailPageNotFound entity="Mob" id={id} back={BACK} />;

  const m = mobQ.data;
  return (
    <DetailPageLayout
      back={BACK}
      header={
        <header className="flex items-center gap-3">
          <EntityIcon entity="mob" id={m.id} size={96} placeholder={Skull} alt={m.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
                {m.name}
              </h1>
              {m.isBoss && (
                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  <Crown className="h-3 w-3" /> Boss
                </span>
              )}
            </div>
            {showIds && <p className="text-muted-foreground font-mono text-xs">{m.id}</p>}
          </div>
        </header>
      }
      aside={
        <>
          {(showIds || m.isBoss) && (
            <InfoSection title="Info">
              {showIds && <InfoRow label="ID" value={String(m.id)} mono />}
              {m.isBoss && <InfoRow label="Boss" value="Yes" />}
            </InfoSection>
          )}
          <InfoSection title="Stats">
            <InfoRow label="Level" value={m.level !== null ? String(m.level) : '—'} />
            <InfoRow label="HP" value={m.hp !== null ? m.hp.toLocaleString() : '—'} />
            <InfoRow label="MP" value={m.mp !== null ? m.mp.toLocaleString() : '—'} />
            <InfoRow label="EXP" value={<ExpValue exp={m.exp} />} />
          </InfoSection>
          <MobElementsSection element={m.elementAttack} />
          <SourceSection path={m.sourcePath} />
        </>
      }
    >
      <CollectionBadgeStrip entityType="mob" entityId={m.id} />

      <DetailListSection
        icon={Package}
        title="Drops"
        count={dropsQ.data?.length}
        isLoading={dropsQ.isLoading}
        isEmpty={dropsQ.data?.length === 0}
        action={
          dropsQ.data && dropsQ.data.length > 0 ? (
            <ListSortControl
              fields={dropSort.fieldOptions}
              value={dropSort.sort}
              onChange={dropSort.setSort}
            />
          ) : null
        }
      >
        {dropSort.sorted.map((d) =>
          d.entity === null ? (
            <li key={d.itemId} className="flex items-center gap-3 px-3 py-1.5 text-sm">
              <EntityAvatar entity="item" id={d.itemId} alt={d.itemName ?? undefined} />
              <span className="text-muted-foreground min-w-0 flex-1 truncate italic">
                {d.itemName ?? `Item #${d.itemId}`}
              </span>
              {showIds && (
                <span className="text-muted-foreground shrink-0 font-mono text-xs">{d.itemId}</span>
              )}
            </li>
          ) : (
            <EntityRow key={d.itemId} entity={d.entity} id={d.itemId} name={d.itemName} />
          ),
        )}
      </DetailListSection>

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
          {mapsSort.sorted.map((mp) => (
            <EntityRow
              key={mp.id}
              entity="map"
              id={mp.id}
              name={mp.name}
              subtitle={mp.streetName}
              meta={mp.spawnCount !== null && mp.spawnCount > 0 ? `×${mp.spawnCount}` : undefined}
              trailing={
                mp.minimapPath && (
                  <Link
                    to={`/maps/${mp.id}?viewer=mob:${m.id}`}
                    aria-label={`Show ${m.name} on ${mp.name ?? `Map ${mp.id}`}`}
                    title="Show on map"
                    className="text-muted-foreground hover:bg-background hover:text-foreground focus-visible:ring-primary/60 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md opacity-0 transition focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 group-hover:opacity-100 max-md:opacity-100"
                  >
                    <MapPin className="h-4 w-4" />
                  </Link>
                )
              }
            />
          ))}
        </DetailListSection>
      )}

      {features.hasQuests && (
        <DetailListSection
          icon={ScrollText}
          title="Required by quests"
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
    </DetailPageLayout>
  );
}
