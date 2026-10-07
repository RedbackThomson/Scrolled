import { Pin, PinOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@scrolled/design';
import { iconForScope, labelForScope, listingRouteForScope } from '@/lib/entityRoutes';
import { useCommandPalette } from '@/stores/useCommandPalette';
import {
  useCreatePinnedSearch,
  useDeletePinnedSearch,
  usePinnedSearches,
} from '@/hooks/usePinnedSearches';
import type { SavedSearchScope } from '@/db/user';
import { PaletteIcon } from '@/components/command-palette/PaletteIcon';

const LISTING_PATHS: Record<string, SavedSearchScope> = {
  '/items': 'item',
  '/equips': 'equip',
  '/weapons': 'weapon',
  '/mobs': 'mob',
  '/npcs': 'npc',
  '/maps': 'map',
  '/quests': 'quest',
  '/quest-chains': 'questChain',
  '/skills': 'skill',
};

function activeListingEntity(pathname: string): SavedSearchScope | null {
  return LISTING_PATHS[pathname] ?? null;
}

function fuzzyMatch(query: string, hay: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return hay.toLowerCase().includes(q);
}

/**
 * Context-aware "pin the current filtered view" command. Only renders when
 * the user is on a listing page with active URL params AND has typed a
 * name — sits near the top so search-results-for-the-typed-name don't
 * bury it.
 */
export function PinCurrentProvider() {
  const location = useLocation();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const createM = useCreatePinnedSearch();

  const activeEntity = activeListingEntity(location.pathname);
  const hasActiveParams = activeEntity != null && location.search.length > 1;
  const canPin = hasActiveParams && query.trim().length > 0;
  if (!canPin || !activeEntity) return null;

  return (
    <CommandGroup heading="Pin">
      <CommandItemPrimitive
        value="pin-current"
        keywords={['pin', 'save', 'bookmark', labelForScope(activeEntity, true)]}
        onSelect={async () => {
          const params = Object.fromEntries(new URLSearchParams(location.search));
          await createM.mutateAsync({
            name: query.trim(),
            entity: activeEntity,
            params,
          });
          setOpen(false);
        }}
      >
        <PaletteIcon icon={Pin} />
        <span className="min-w-0 flex-1 truncate">
          Pin current filter as "<span className="font-medium">{query.trim()}</span>"
        </span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {labelForScope(activeEntity, true)}
        </span>
      </CommandItemPrimitive>
    </CommandGroup>
  );
}

/** List of saved pinned searches — re-runnable. Lower priority. */
export function PinnedSearchesProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const pinnedQ = usePinnedSearches();
  const deleteM = useDeletePinnedSearch();

  const items = pinnedQ.data ?? [];
  const visible = items.filter((p) => fuzzyMatch(query, `${p.name} ${labelForScope(p.entity)}`));
  if (visible.length === 0) return null;

  return (
    <CommandGroup heading="Pinned searches">
      {visible.map((p) => {
        const Icon = iconForScope(p.entity);
        const sp = new URLSearchParams(p.params);
        const target = `${listingRouteForScope(p.entity)}${sp.toString() ? `?${sp.toString()}` : ''}`;
        return (
          <CommandItemPrimitive
            key={`pinned-${p.id}`}
            value={`pinned-${p.id}`}
            keywords={[p.name, labelForScope(p.entity)]}
            onSelect={() => {
              navigate(target);
              setOpen(false);
            }}
          >
            <PaletteIcon icon={Icon} />
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {labelForScope(p.entity, true)}
            </span>
            <button
              type="button"
              aria-label={`Delete pinned search ${p.name}`}
              className="text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void deleteM.mutateAsync(p.id);
              }}
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
