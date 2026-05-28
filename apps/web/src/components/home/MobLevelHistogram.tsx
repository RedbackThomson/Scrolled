// Mob count by level band. Bars are clickable: each one routes to the
// mobs listing with the matching f_level_min/f_level_max filter applied.
//
// Empty bands inside the dataset's level range are filled in client-side
// so a gap in the data shows up as visibly missing rather than collapsed.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDbClient } from '@/db';
import type { Features } from '@/hooks/useFeatures';
import { HomeSection } from './HomeSection';

const BAND_SIZE = 10;

interface BandRow {
  band: number;
  count: number;
  label: string;
}

export function MobLevelHistogram({ features }: { features: Features }) {
  const db = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['home', 'mob-level-bands', BAND_SIZE],
    queryFn: () => db.listMobLevelBandCounts(BAND_SIZE),
    enabled: features.hasMobs,
  });
  const navigate = useNavigate();

  if (!features.hasMobs) return null;
  const raw = q.data ?? [];
  if (raw.length === 0) return null;

  const data = fillGaps(raw, BAND_SIZE);

  return (
    <HomeSection title="Mobs by level">
      <div className="border-border bg-card rounded-md border p-3">
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                width={32}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 6,
                  color: 'hsl(var(--card-foreground))',
                  fontSize: 12,
                  // Recharts inlines an opaque background only if you also
                  // override boxShadow; otherwise the default shadow draws
                  // before the bg color and the panel reads as see-through.
                  boxShadow: '0 4px 12px hsl(var(--foreground) / 0.08)',
                }}
                formatter={(value) => [Number(value ?? 0).toLocaleString(), 'Mobs']}
                labelFormatter={(label) => `Level ${String(label)}`}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[2, 2, 0, 0]}
                cursor="pointer"
                onClick={(bar) => {
                  // Recharts surfaces the original row on `payload` of the
                  // BarRectangleItem. Defensive cast — typings list it as
                  // `any` but the runtime shape is stable.
                  const datum = (bar as { payload?: BandRow }).payload;
                  if (!datum) return;
                  const min = datum.band;
                  const max = datum.band + BAND_SIZE - 1;
                  navigate(`/mobs?f_level_min=${min}&f_level_max=${max}`);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Click a bar to browse mobs in that range.
        </p>
      </div>
    </HomeSection>
  );
}

/** Insert zero rows for any band missing inside [min..max] so a sparse
 *  level range reads as a visible gap rather than a collapsed axis. */
function fillGaps(rows: { band: number; count: number }[], bandSize: number): BandRow[] {
  if (rows.length === 0) return [];
  const min = rows[0]!.band;
  const max = rows[rows.length - 1]!.band;
  const lookup = new Map(rows.map((r) => [r.band, r.count]));
  const out: BandRow[] = [];
  for (let b = min; b <= max; b += bandSize) {
    out.push({
      band: b,
      count: lookup.get(b) ?? 0,
      label: `${b}–${b + bandSize - 1}`,
    });
  }
  return out;
}
