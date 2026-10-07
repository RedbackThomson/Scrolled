// Saved searches pinned to Home — chips that open each search on its list
// page, loaded so its changes can be tracked there.

import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Icon } from '@scrolled/design';
import { usePinnedSearches, useUpdatePinnedSearch } from '@/hooks/usePinnedSearches';
import { listingRouteForScope } from '@/lib/entityRoutes';
import { savedSearchLook } from '@/components/pinned-searches';
import { HomeSection } from './HomeSection';

export function PinnedSearchesRow() {
  const q = usePinnedSearches();
  const updateM = useUpdatePinnedSearch();
  const items = (q.data ?? []).filter((p) => p.pinned);
  if (items.length === 0) return null;

  return (
    <HomeSection title="Saved searches">
      <ul className="flex flex-wrap gap-2">
        {items.map((p) => {
          const look = savedSearchLook(p);
          const params = new URLSearchParams(p.params);
          params.set('saved', String(p.id));
          return (
            <li key={p.id} className="group relative inline-flex">
              <Link
                to={`${listingRouteForScope(p.entity)}?${params.toString()}`}
                className="sc-focus-ring bg-card text-card-foreground ease-spring inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-8 text-[13px] font-bold shadow-[inset_0_-2px_0_var(--border-1)] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ borderColor: `oklch(0.7 0.12 ${look.hue} / .55)` }}
              >
                <span
                  aria-hidden
                  className="grid h-[22px] w-[22px] place-items-center rounded-full"
                  style={{
                    background: `oklch(0.72 0.12 ${look.hue} / .22)`,
                    color: `oklch(0.58 0.15 ${look.hue})`,
                  }}
                >
                  <Icon icon={look.icon} size={12} />
                </span>
                {p.name}
              </Link>
              <button
                type="button"
                onClick={() => updateM.mutate({ id: p.id, patch: { pinned: false } })}
                disabled={updateM.isPending}
                aria-label={`Remove “${p.name}” from Home`}
                title="Remove from Home"
                className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
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
