// Compact "what's in my library?" panel. Pulls everything from the DB
// status counts that useFeatures already loads, plus a single
// listDatasets call so we can show the most recent import time.
//
// Each cell is a plain (label, value) tuple — no charts, no links. The
// browse tiles already carry the navigation; this card is informational.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, FileStack, Clock } from 'lucide-react';
import { getDbClient } from '@/db';
import type { Features } from '@/hooks/useFeatures';
import { HomeSection } from './HomeSection';

export function LibraryStats({ features }: { features: Features }) {
  const db = useMemo(() => getDbClient(), []);
  const datasetsQ = useQuery({
    queryKey: ['home', 'datasets-list'],
    queryFn: () => db.listDatasets(),
    enabled: features.ready,
  });

  if (!features.counts) return null;
  const c = features.counts;
  const total = c.items + c.equips + c.mobs + c.npcs + c.maps + c.quests;
  if (total === 0) return null;

  const datasets = datasetsQ.data ?? [];
  const lastImport = datasets.length > 0 ? datasets[0]!.loadedAt : null;

  return (
    <HomeSection title="Library">
      <dl className="border-border bg-card text-card-foreground grid grid-cols-2 gap-px overflow-hidden rounded-md border sm:grid-cols-4">
        <Stat icon={Database} label="Records" value={total.toLocaleString()} />
        <Stat icon={FileStack} label="Datasets" value={c.datasets.toLocaleString()} />
        <Stat
          icon={FileStack}
          label="WZ files"
          value={features.loadedFiles.size.toLocaleString()}
        />
        <Stat
          icon={Clock}
          label="Last import"
          value={lastImport ? formatDateShort(lastImport) : '—'}
        />
      </dl>
    </HomeSection>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card flex items-center gap-3 p-3">
      <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <dt className="text-muted-foreground text-xs">{label}</dt>
        <dd className="font-mono text-sm font-semibold">{value}</dd>
      </div>
    </div>
  );
}

function formatDateShort(ts: number): string {
  // Local time, no year unless it's not this year — keeps the cell narrow.
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}
