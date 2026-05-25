import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Skull } from 'lucide-react';
import { DetailListSection } from '@/components/DetailListSection';
import {
  DetailPageLayout,
  DetailPageLoading,
  DetailPageNotFound,
  InfoRow,
  InfoSection,
  SourceSection,
} from '@/components/DetailPageLayout';
import { EntityRow } from '@/components/EntityRow';
import { ItemIcon } from '@/components/ItemIcon';
import { ListSortControl } from '@/components/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';
import { labelForEquipSlot, labelForEquipType } from '@/lib/equipTypes';
import { formatEquipJobs, parseReqJob } from '@/lib/equipJobs';
import { useListSort } from '@/lib/useListSort';

export default function EquipDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();

  const equipQ = useQuery({
    queryKey: ['db', 'equip', id],
    queryFn: () => client.getEquip(id),
    enabled: Number.isFinite(id),
  });
  const droppedByQ = useQuery({
    queryKey: ['db', 'equip', id, 'dropped-by'],
    queryFn: () => client.getItemDroppedBy(id),
    enabled: Number.isFinite(id) && features.hasMobs,
  });

  const droppedBySort = useListSort(droppedByQ.data, [
    { id: 'name', label: 'Mob name', get: (m) => m.name },
    { id: 'level', label: 'Level', get: (m) => m.level },
  ]);

  const paletteItems = useMemo<CommandItem[]>(
    () => [
      {
        id: 'copy-equip-id',
        group: 'context',
        label: 'Copy equip ID',
        keywords: ['copy', 'id', 'clipboard'],
        icon: Copy,
        onSelect: () => navigator.clipboard.writeText(String(id)),
      },
    ],
    [id],
  );
  useDetailPalette({ entity: 'equip', id, name: equipQ.data?.name, items: paletteItems });

  // Route the breadcrumb back to whichever listing this row came from, so
  // a user landing here from /weapons doesn't get bounced to /equips.
  const isWeapon = equipQ.data?.equipType !== null && equipQ.data?.equipType !== undefined;
  const back = isWeapon
    ? { to: '/weapons', label: 'Back to weapons' }
    : { to: '/equips', label: 'Back to equips' };

  if (equipQ.isLoading) return <DetailPageLoading entity="Equip" id={id} />;
  if (equipQ.error) {
    return <p className="text-destructive text-sm">{(equipQ.error as Error).message}</p>;
  }
  if (!equipQ.data) return <DetailPageNotFound entity="Equip" id={id} back={back} />;

  const e = equipQ.data;
  const hasAnyRequirement =
    e.requiredLevel !== null ||
    e.requiredStr !== null ||
    e.requiredDex !== null ||
    e.requiredInt !== null ||
    e.requiredLuk !== null ||
    e.requiredJob !== null;
  const hasAnyStat =
    e.attack !== null ||
    e.magicAttack !== null ||
    e.defense !== null ||
    e.magicDefense !== null ||
    e.accuracy !== null ||
    e.avoidability !== null ||
    e.upgradeSlots !== null;

  return (
    <DetailPageLayout
      back={back}
      header={
        <header className="flex items-center gap-3">
          <ItemIcon entity="equip" id={e.id} size={48} alt={e.name} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{e.name}</h1>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-mono">{e.id}</span>
              {e.cash && (
                <span className="inline-flex items-center rounded bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-medium text-pink-700 dark:text-pink-300">
                  Cash Shop (cosmetic)
                </span>
              )}
              {e.equipType && (
                <span className="inline-flex items-center rounded bg-slate-500/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                  {labelForEquipType(e.equipType)}
                </span>
              )}
            </div>
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            <InfoRow label="ID" value={String(e.id)} mono />
            <InfoRow label="Slot" value={e.slot ? labelForEquipSlot(e.slot) : '—'} />
            {e.equipType && <InfoRow label="Type" value={labelForEquipType(e.equipType)} />}
            <InfoRow label="Source" value={e.cash ? 'Cash shop' : 'In-game'} />
          </InfoSection>
          {hasAnyRequirement && (
            <InfoSection title="Requirements">
              <StatRow label="Level" value={e.requiredLevel} />
              <StatRow label="STR" value={e.requiredStr} />
              <StatRow label="DEX" value={e.requiredDex} />
              <StatRow label="INT" value={e.requiredInt} />
              <StatRow label="LUK" value={e.requiredLuk} />
              {e.requiredJob !== null && (
                <InfoRow label="Class" value={formatEquipJobs(parseReqJob(e.requiredJob))} />
              )}
            </InfoSection>
          )}
          {hasAnyStat && (
            <InfoSection title="Stats">
              <StatRow label="Attack" value={e.attack} />
              <StatRow label="Magic atk" value={e.magicAttack} />
              <StatRow label="Defense" value={e.defense} />
              <StatRow label="Magic def" value={e.magicDefense} />
              <StatRow label="Accuracy" value={e.accuracy} />
              <StatRow label="Avoidability" value={e.avoidability} />
              <StatRow label="Upgrade slots" value={e.upgradeSlots} />
            </InfoSection>
          )}
          <SourceSection path={e.sourcePath} />
        </>
      }
    >
      <CollectionBadgeStrip entityType="equip" entityId={e.id} />

      {e.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed">{e.description}</p>
      ) : (
        <p className="text-muted-foreground text-sm italic">No description available.</p>
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
              meta={m.level !== null ? `Lv ${m.level}` : undefined}
            />
          ))}
        </DetailListSection>
      )}
    </DetailPageLayout>
  );
}

function StatRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === 0) return null;
  return <InfoRow label={label} value={String(value)} />;
}
