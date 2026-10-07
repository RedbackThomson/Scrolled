// Top map regions, derived from `street_name` row counts. Renders nothing
// if maps aren't loaded or no map carries a non-empty street name — both
// states are uninteresting to the user, and the parent's BrowseTiles
// already provides a fallback path to /maps.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDbClient } from '@/db';
import type { Features } from '@/hooks/useFeatures';
import { HomeSection } from './HomeSection';

const TOP_N = 8;

export function MapsByRegion({ features }: { features: Features }) {
  const db = useMemo(() => getDbClient(), []);
  const q = useQuery({
    queryKey: ['home', 'maps-by-street', TOP_N],
    queryFn: () => db.listMapStreetCounts(TOP_N),
    enabled: features.hasMaps,
  });

  if (!features.hasMaps) return null;
  const rows = q.data ?? [];
  if (rows.length === 0) return null;

  return (
    <HomeSection title="Regions">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              to={`/maps?f_streetName=${encodeURIComponent(r.key)}`}
              className="bg-card text-card-foreground shadow-float ease-spring group flex items-center gap-2 rounded-full px-3.5 py-2 transition-transform duration-300 hover:-translate-y-0.5"
              title={`${r.count.toLocaleString()} maps in ${r.key}`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[oklch(0.56_0.14_185)]" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{r.key}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {r.count.toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
