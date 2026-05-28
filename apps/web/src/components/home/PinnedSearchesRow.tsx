// Pinned saved searches — a chip row that deep-links to each entity's
// list page with the saved filter params applied. The list page picks
// them up via the `f_*` URL convention used everywhere else.
//
// Each chip exposes a hover-only delete button so the only path to
// removing a saved search lives in the UI (the palette mirrors this
// surface; it isn't an exclusive entry point).

import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { usePinnedSearches, useDeletePinnedSearch } from '@/hooks/usePinnedSearches';
import { iconForEntity, listingRouteForEntity } from '@/lib/entityRoutes';
import { HomeSection } from './HomeSection';

export function PinnedSearchesRow() {
  const q = usePinnedSearches();
  const deleteM = useDeletePinnedSearch();
  const items = q.data ?? [];
  if (items.length === 0) return null;

  const onDelete = (id: number, name: string) => {
    if (!confirm(`Delete saved search "${name}"?`)) return;
    void deleteM.mutateAsync(id);
  };

  return (
    <HomeSection title="Saved searches">
      <ul className="flex flex-wrap gap-2">
        {items.map((p) => {
          const Icon = iconForEntity(p.entity);
          const params = new URLSearchParams(p.params);
          const href = `${listingRouteForEntity(p.entity)}?${params.toString()}`;
          return (
            <li key={p.id} className="group relative inline-flex">
              <Link
                to={href}
                className="border-border bg-card text-card-foreground hover:border-foreground/30 inline-flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-2 text-xs transition-colors"
                title={describeParams(p.params)}
              >
                <Icon className="text-muted-foreground h-3.5 w-3.5" />
                <span className="font-medium">{p.name}</span>
                {/* Reserve space for the delete button so the chip width
                    doesn't jump on hover. */}
                <span aria-hidden className="h-3.5 w-3.5" />
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  // Stop the surrounding Link from receiving the click —
                  // we don't want navigating-and-deleting to race.
                  e.preventDefault();
                  e.stopPropagation();
                  onDelete(p.id, p.name);
                }}
                disabled={deleteM.isPending}
                aria-label={`Delete saved search "${p.name}"`}
                title="Delete saved search"
                className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
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
