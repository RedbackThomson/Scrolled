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
              className="border-border bg-card text-card-foreground hover:border-foreground/30 group flex items-center gap-2 rounded-md border px-3 py-2 transition-colors"
              title={`${r.count.toLocaleString()} maps in ${r.key}`}
            >
              <MapPin className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{r.key}</span>
              <span className="text-muted-foreground font-mono text-xs">
                {r.count.toLocaleString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
