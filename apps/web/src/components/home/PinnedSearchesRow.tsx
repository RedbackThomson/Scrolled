// Pinned saved searches — a chip row that deep-links to each entity's
// list page with the saved filter params applied. The list page picks
// them up via the `f_*` URL convention used everywhere else.

import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { usePinnedSearches } from '@/hooks/usePinnedSearches';
import { iconForEntity, listingRouteForEntity } from '@/lib/entityRoutes';
import { HomeSection } from './HomeSection';

export function PinnedSearchesRow() {
  const q = usePinnedSearches();
  const items = q.data ?? [];
  if (items.length === 0) return null;

  return (
    <HomeSection title="Saved searches">
      <ul className="flex flex-wrap gap-2">
        {items.map((p) => {
          const Icon = iconForEntity(p.entity);
          const params = new URLSearchParams(p.params);
          const href = `${listingRouteForEntity(p.entity)}?${params.toString()}`;
          return (
            <li key={p.id}>
              <Link
                to={href}
                className="border-border bg-card text-card-foreground hover:border-foreground/30 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors"
                title={describeParams(p.params)}
              >
                <Icon className="text-muted-foreground h-3.5 w-3.5" />
                <span className="font-medium">{p.name}</span>
                <Search className="text-muted-foreground h-3 w-3" />
              </Link>
            </li>
          );
        })}
      </ul>
    </HomeSection>
  );
}

function describeParams(params: Record<string, string>): string {
  const keys = Object.keys(params);
  if (keys.length === 0) return 'No filters';
  return keys.map((k) => `${k.replace(/^f_/, '')}=${params[k]}`).join(', ');
}
