import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Skull } from 'lucide-react';
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
import { EQUIP_FLAG_ORDER } from '@/components/entity-display/metadataFlags';
import { ListSortControl } from '@/components/common/ListSortControl';
import { CollectionBadgeStrip } from '@/components/collections';
import { useDetailPalette } from '@/components/command-palette/useDetailPalette';
import type { CommandItem } from '@/components/command-palette/types';
import { getDbClient } from '@/db';
import { useFeatures } from '@/hooks/useFeatures';
import { ABILITY_STAT_FIELDS } from '@/domain/abilityStats';
import { labelForEquipSlot, labelForEquipType } from '@/domain/equipTypes';
import { formatEquipJobs, parseReqJob } from '@/domain/equipJobs';
import { useListSort } from '@/hooks/useListSort';
import { useServerProfile } from '@/hooks/useServerProfile';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { StatRangeRow, StatRow } from '@/components/entity-display/EquipStatDisplay';

export default function EquipDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);
  const features = useFeatures();
  const serverProfile = useServerProfile();
  const showIds = useShowEntityIds((s) => s.enabled);

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

  if (equipQ.isLoading) return <DetailPageLoading entity="Equip" id={id} />;
  if (equipQ.error) {
    return <p className="text-destructive text-sm">{(equipQ.error as Error).message}</p>;
  }
  if (!equipQ.data) return <DetailPageNotFound entity="Equip" id={id} />;

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
    e.upgradeSlots !== null ||
    e.incStr !== null ||
    e.incDex !== null ||
    e.incInt !== null ||
    e.incLuk !== null ||
    e.incHp !== null ||
    e.incMp !== null ||
    e.incSpeed !== null ||
    e.incJump !== null;
  const statRanges = serverProfile.equipRanges({
    attack: e.attack,
    magicAttack: e.magicAttack,
    defense: e.defense,
    magicDefense: e.magicDefense,
    accuracy: e.accuracy,
    avoidability: e.avoidability,
    incStr: e.incStr,
    incDex: e.incDex,
    incInt: e.incInt,
    incLuk: e.incLuk,
    incHp: e.incHp,
    incMp: e.incMp,
  });

  return (
    <DetailPageLayout
      header={
        <header className="flex items-center gap-3">
          <ItemIcon entity="equip" id={e.id} size={48} alt={e.name} />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-xl font-semibold tracking-tight md:text-3xl">
              {e.name}
            </h1>
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
              {showIds && <span className="font-mono">{e.id}</span>}
              {e.cash && <Badge tone="pink">Cash Shop (cosmetic)</Badge>}
              {e.equipType && <Badge tone="slate">{labelForEquipType(e.equipType)}</Badge>}
              <MetadataFlagBadges flags={e} order={EQUIP_FLAG_ORDER} />
            </div>
          </div>
        </header>
      }
      aside={
        <>
          <InfoSection title="Info">
            {showIds && <InfoRow label="ID" value={String(e.id)} mono />}
            <InfoRow label="Slot" value={e.slot ? labelForEquipSlot(e.slot) : '—'} />
            {e.equipType && <InfoRow label="Type" value={labelForEquipType(e.equipType)} />}
            <InfoRow label="Source" value={e.cash ? 'Cash shop' : 'In-game'} />
          </InfoSection>
          {hasAnyRequirement && (
            <InfoSection title="Requirements">
              <StatRow label="Level" value={e.requiredLevel} />
              {ABILITY_STAT_FIELDS.map((s) => (
                <StatRow key={s.label} label={s.label} value={e[s.required]} />
              ))}
              {e.requiredJob !== null && (
                <InfoRow label="Class" value={formatEquipJobs(parseReqJob(e.requiredJob))} />
              )}
            </InfoSection>
          )}
          {hasAnyStat && (
            <InfoSection title="Stats">
              <StatRangeRow label="Attack" value={e.attack} range={statRanges.attack} />
              <StatRangeRow
                label="Magic atk"
                value={e.magicAttack}
                range={statRanges.magicAttack}
              />
              {ABILITY_STAT_FIELDS.map((s) => (
                <StatRangeRow
                  key={s.label}
                  label={s.label}
                  value={e[s.inc]}
                  range={statRanges[s.inc]}
                />
              ))}
              <StatRangeRow label="HP" value={e.incHp} range={statRanges.incHp} />
              <StatRangeRow label="MP" value={e.incMp} range={statRanges.incMp} />
              <StatRangeRow label="Defense" value={e.defense} range={statRanges.defense} />
              <StatRangeRow
                label="Magic def"
                value={e.magicDefense}
                range={statRanges.magicDefense}
              />
              <StatRangeRow label="Accuracy" value={e.accuracy} range={statRanges.accuracy} />
              <StatRangeRow
                label="Avoidability"
                value={e.avoidability}
                range={statRanges.avoidability}
              />
              <StatRow label="Speed" value={e.incSpeed} />
              <StatRow label="Jump" value={e.incJump} />
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
