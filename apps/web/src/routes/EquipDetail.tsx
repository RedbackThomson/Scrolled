import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Skull } from 'lucide-react';
import { EntityIcon } from '@/components/EntityIcon';
import { ItemIcon } from '@/components/ItemIcon';
import { MobLink } from '@/components/entity-links';
import { CollectionBadgeStrip } from '@/components/collections';
import { getDbClient } from '@/db';
import { useFeatures } from '@/lib/useFeatures';

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

  if (equipQ.isLoading) {
    return (
      <p className="text-muted-foreground text-sm">
        <Loader2 className="inline h-4 w-4 animate-spin" /> Loading equip {id}…
      </p>
    );
  }

  if (equipQ.error) {
    return <p className="text-destructive text-sm">{(equipQ.error as Error).message}</p>;
  }

  if (!equipQ.data) {
    return (
      <div className="max-w-3xl">
        <Link
          to="/equips"
          className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to equips
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Equip not found</h1>
      </div>
    );
  }

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
    <div className="max-w-4xl space-y-6">
      <Link
        to="/equips"
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to equips
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-4">
          <header className="flex items-center gap-3">
            <ItemIcon entity="equip" id={e.id} size={48} alt={e.name} />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">{e.name}</h1>
              <p className="text-muted-foreground font-mono text-xs">{e.id}</p>
            </div>
          </header>

          <CollectionBadgeStrip entityType="equip" entityId={e.id} />

          {e.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{e.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description available.</p>
          )}

          {features.hasMobs && droppedByQ.data && droppedByQ.data.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Skull className="h-4 w-4" /> Dropped by
                <span className="text-muted-foreground text-xs normal-case">
                  ({droppedByQ.data.length})
                </span>
              </h2>
              <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                {droppedByQ.data.map((m) => (
                  <li key={m.mobId}>
                    <MobLink
                      id={m.mobId}
                      className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm"
                    >
                      <EntityIcon entity="mob" id={m.mobId} size={24} placeholder={Skull} alt={m.name} />
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      {m.level !== null && (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          Lv {m.level}
                        </span>
                      )}
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {m.mobId}
                      </span>
                    </MobLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Info</h2>
            <dl className="divide-border divide-y">
              <Row label="ID" value={String(e.id)} mono />
              <Row label="Slot" value={e.slot ?? '—'} capitalize />
            </dl>
          </section>

          {hasAnyRequirement && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Requirements</h2>
              <dl className="divide-border divide-y">
                <StatRow label="Level" value={e.requiredLevel} />
                <StatRow label="STR" value={e.requiredStr} />
                <StatRow label="DEX" value={e.requiredDex} />
                <StatRow label="INT" value={e.requiredInt} />
                <StatRow label="LUK" value={e.requiredLuk} />
                {e.requiredJob !== null && <Row label="Job" value={describeJob(e.requiredJob)} />}
              </dl>
            </section>
          )}

          {hasAnyStat && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Stats</h2>
              <dl className="divide-border divide-y">
                <StatRow label="Attack" value={e.attack} />
                <StatRow label="Magic atk" value={e.magicAttack} />
                <StatRow label="Defense" value={e.defense} />
                <StatRow label="Magic def" value={e.magicDefense} />
                <StatRow label="Accuracy" value={e.accuracy} />
                <StatRow label="Avoidability" value={e.avoidability} />
                <StatRow label="Upgrade slots" value={e.upgradeSlots} />
              </dl>
            </section>
          )}

          <div className="text-muted-foreground text-xs">
            <div className="uppercase tracking-wide">WZ path</div>
            <code className="break-all font-mono">{e.sourcePath}</code>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd
        className={`${mono ? 'font-mono text-sm' : 'text-sm'} ${capitalize ? 'capitalize' : ''}`}
      >
        {value}
      </dd>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === 0) return null;
  return <Row label={label} value={String(value)} />;
}

/**
 * Decode a MapleStory job-requirement bitfield. The exact bits vary by
 * version; in the GMS-style data we target, low nibble flags whether each
 * class line is eligible. We surface the raw bits alongside a friendly
 * summary so it's still useful for unknown values.
 */
function describeJob(bitfield: number): string {
  const known: { bit: number; label: string }[] = [
    { bit: 1, label: 'Warrior' },
    { bit: 2, label: 'Magician' },
    { bit: 4, label: 'Archer' },
    { bit: 8, label: 'Thief' },
    { bit: 16, label: 'Pirate' },
  ];
  if (bitfield === 0) return 'Any';
  const matched = known.filter((j) => (bitfield & j.bit) !== 0).map((j) => j.label);
  if (matched.length === 0) return `0x${bitfield.toString(16)}`;
  return matched.join(', ');
}
