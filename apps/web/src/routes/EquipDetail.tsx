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
import { labelForEquipSlot, labelForEquipType } from '@/lib/equipTypes';
import { formatEquipJobs, parseReqJob } from '@/lib/equipJobs';

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
  // Route the breadcrumb back to whichever listing this row came from, so
  // a user landing here from /weapons doesn't get bounced to /equips.
  const isWeapon = e.equipType !== null;
  const backTo = isWeapon ? '/weapons' : '/equips';
  const backLabel = isWeapon ? 'Back to weapons' : 'Back to equips';
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
        to={backTo}
        className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="grid gap-6 sm:grid-cols-[1fr_18rem]">
        <article className="space-y-6">
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

          <CollectionBadgeStrip entityType="equip" entityId={e.id} />

          {e.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{e.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description available.</p>
          )}

          {features.hasMobs && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
                <Skull className="h-4 w-4" /> Dropped by
                {droppedByQ.data && (
                  <span className="text-muted-foreground text-xs normal-case">
                    ({droppedByQ.data.length})
                  </span>
                )}
              </h2>
              {droppedByQ.isLoading && (
                <p className="text-muted-foreground text-xs">Loading mobs…</p>
              )}
              {droppedByQ.data && droppedByQ.data.length === 0 && (
                <p className="text-muted-foreground text-xs italic">None.</p>
              )}
              {droppedByQ.data && droppedByQ.data.length > 0 && (
                <ul className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
                  {droppedByQ.data.map((m) => (
                    <li key={m.mobId}>
                      <MobLink
                        id={m.mobId}
                        className="hover:bg-accent flex items-center gap-3 px-3 py-1.5 text-sm"
                      >
                        <EntityIcon
                          entity="mob"
                          id={m.mobId}
                          size={24}
                          placeholder={Skull}
                          alt={m.name}
                        />
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                        {m.level !== null && (
                          <span className="text-muted-foreground shrink-0 text-xs">Lv {m.level}</span>
                        )}
                        <span className="text-muted-foreground shrink-0 font-mono text-xs">
                          {m.mobId}
                        </span>
                      </MobLink>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </article>

        <aside className="border-border bg-card text-card-foreground self-start space-y-4 rounded-md border p-4 text-sm">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Info</h2>
            <dl className="divide-border divide-y">
              <Row label="ID" value={String(e.id)} mono />
              <Row label="Slot" value={e.slot ? labelForEquipSlot(e.slot) : '—'} />
              {e.equipType && <Row label="Type" value={labelForEquipType(e.equipType)} />}
              <Row label="Source" value={e.cash ? 'Cash shop' : 'In-game'} />
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
                {e.requiredJob !== null && (
                  <Row label="Class" value={formatEquipJobs(parseReqJob(e.requiredJob))} />
                )}
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
      <dd className={`${mono ? 'font-mono text-sm' : 'text-sm'} ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === 0) return null;
  return <Row label={label} value={String(value)} />;
}
