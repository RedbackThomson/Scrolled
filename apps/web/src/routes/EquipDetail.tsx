import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ItemIcon } from '@/components/ItemIcon';
import { getDbClient } from '@/db';

export default function EquipDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const client = useMemo(() => getDbClient(), []);

  const equipQ = useQuery({
    queryKey: ['db', 'equip', id],
    queryFn: () => client.getEquip(id),
    enabled: Number.isFinite(id),
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

          {e.description ? (
            <p className="whitespace-pre-line text-sm leading-relaxed">{e.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">No description available.</p>
          )}

          <p className="text-muted-foreground text-xs">
            Stat block (attack, defense, requirements) comes from{' '}
            <code className="font-mono">Character.wz</code>, which isn't yet wired up — those fields
            show "—" until a later phase adds it.
          </p>
        </article>

        <aside className="border-border bg-card text-card-foreground rounded-md border p-4 text-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide">Info</h2>
          <dl className="divide-border divide-y">
            <Row label="ID" value={String(e.id)} mono />
            <Row label="Slot" value={e.slot ?? '—'} />
            <Row
              label="Req. level"
              value={e.requiredLevel !== null ? String(e.requiredLevel) : '—'}
            />
            <Row label="Req. job" value={e.requiredJob !== null ? String(e.requiredJob) : '—'} />
            <Row label="Attack" value={e.attack !== null ? String(e.attack) : '—'} />
            <Row label="Magic atk" value={e.magicAttack !== null ? String(e.magicAttack) : '—'} />
            <Row label="Defense" value={e.defense !== null ? String(e.defense) : '—'} />
            <Row
              label="Upgrade slots"
              value={e.upgradeSlots !== null ? String(e.upgradeSlots) : '—'}
            />
          </dl>
          <div className="text-muted-foreground mt-4 text-xs">
            <div className="uppercase tracking-wide">WZ path</div>
            <code className="break-all font-mono">{e.sourcePath}</code>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</dd>
    </div>
  );
}
