// Equip restriction breakdown. The pie shows exclusive buckets — an
// equip with no class restriction lands in "Any class", an equip
// restricted to exactly one class lands in that class, and an equip
// restricted to more than one class lands in "Multi-class". The buckets
// sum to the total equip count.
//
// The pie itself is informational; a row of class chips below it
// provides the actionable "browse equips Warriors can wear" link, which
// is a different (overlapping) subset than the bucket above.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { getDbClient, type EquipJobBucket } from '@/db';
import type { Features } from '@/hooks/useFeatures';
import { ALL_EQUIP_CLASSES } from '@/domain/equipJobs';
import { HomeSection } from './HomeSection';

const BUCKET_LABEL: Record<EquipJobBucket, string> = {
  any: 'Any class',
  warrior: 'Warrior only',
  magician: 'Magician only',
  bowman: 'Bowman only',
  thief: 'Thief only',
  pirate: 'Pirate only',
  multi: 'Multi-class',
};

// Bucket colors are picked to read on top of the card background in both
// themes and to map 1:1 with the chip-row colors below the chart.
const BUCKET_COLOR: Record<EquipJobBucket, string> = {
  any: 'hsl(var(--muted-foreground))',
  warrior: '#dc2626', // red-600
  magician: '#7c3aed', // violet-600
  bowman: '#16a34a', // green-600
  thief: '#a16207', // amber-700
  pirate: '#0891b2', // cyan-600
  multi: 'hsl(var(--primary))',
};

export function EquipJobBreakdown({ features }: { features: Features }) {
  const db = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['home', 'equip-job-counts'],
    queryFn: () => db.listEquipJobCounts(),
    enabled: features.hasEquips,
  });

  if (!features.hasEquips) return null;
  const buckets = q.data ?? [];
  const total = buckets.reduce((acc, b) => acc + b.count, 0);
  if (total === 0) return null;

  const data = buckets
    .filter((b) => b.count > 0)
    .map((b) => ({
      job: b.job,
      label: BUCKET_LABEL[b.job],
      count: b.count,
    }));

  return (
    <HomeSection title="Equip restrictions">
      <div className="border-border bg-card rounded-md border p-3">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={1}
                stroke="hsl(var(--card))"
              >
                {data.map((d) => (
                  <Cell key={d.job} fill={BUCKET_COLOR[d.job]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  color: 'hsl(var(--card-foreground))',
                  fontSize: 12,
                  boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
                }}
                formatter={(value, _name, entry) => {
                  const n = Number(value ?? 0);
                  const pct = ((n / total) * 100).toFixed(1);
                  const label = (entry as { payload?: { label?: string } })?.payload?.label;
                  return [`${n.toLocaleString()} (${pct}%)`, label];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-1 text-xs sm:grid-cols-3">
          {data.map((d) => (
            <li key={d.job} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ background: BUCKET_COLOR[d.job] }}
              />
              <span className="text-muted-foreground truncate">{d.label}</span>
              <span className="text-foreground ml-auto font-mono">{d.count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <div className="border-border mt-3 border-t pt-3">
          <p className="text-muted-foreground mb-1.5 text-xs">Browse equips by class:</p>
          <ul className="flex flex-wrap gap-1.5">
            {ALL_EQUIP_CLASSES.filter((c) => c !== 'Beginner').map((cls) => (
              <li key={cls}>
                <Link
                  to={`/equips?f_requiredJob=${cls}`}
                  className="border-border bg-card hover:border-foreground/30 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs transition-colors"
                >
                  {cls}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </HomeSection>
  );
}
