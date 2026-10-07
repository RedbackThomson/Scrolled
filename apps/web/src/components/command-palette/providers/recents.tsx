import { useNavigate } from 'react-router-dom';
import { Clock, History } from 'lucide-react';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@scrolled/design';
import { labelForEntityKind, routeForEntity } from '@/lib/entityRoutes';
import { useRecentEntities, useRecentQueries } from '@/lib/recents';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { PaletteEntityIcon, PaletteIcon } from '@/components/command-palette/PaletteIcon';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

export function RecentsProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const setQuery = useCommandPalette((s) => s.setQuery);
  const query = useCommandPalette((s) => s.query);

  const entities = useRecentEntities();
  const queries = useRecentQueries();

  const visibleEntities = entities.items
    .filter((e) => fuzzy(query, `${e.name} ${labelForEntityKind(e.entity)}`))
    .slice(0, query.trim() ? 12 : 6);

  const visibleQueries = query.trim() ? [] : queries.items.slice(0, 5);

  if (visibleEntities.length === 0 && visibleQueries.length === 0) return null;

  return (
    <>
      {visibleEntities.length > 0 && (
        <CommandGroup heading="Recently viewed">
          {visibleEntities.map((e) => {
            return (
              <CommandItemPrimitive
                key={`recent-${e.entity}-${e.id}`}
                value={`recent-${e.entity}-${e.id}`}
                keywords={[e.name, String(e.id), e.entity]}
                onSelect={() => {
                  navigate(routeForEntity(e.entity, e.id));
                  setOpen(false);
                }}
              >
                <PaletteEntityIcon entity={e.entity} id={e.id} alt={e.name} />
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {labelForEntityKind(e.entity)}
                </span>
              </CommandItemPrimitive>
            );
          })}
        </CommandGroup>
      )}
      {visibleQueries.length > 0 && (
        <CommandGroup heading="Recent searches">
          {visibleQueries.map((q) => (
            <CommandItemPrimitive
              key={`recent-q-${q.query}`}
              value={`recent-q-${q.query}`}
              keywords={[q.query]}
              onSelect={() => setQuery(q.query)}
            >
              <PaletteIcon icon={History} />
              <span className="min-w-0 flex-1 truncate">{q.query}</span>
              <Clock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            </CommandItemPrimitive>
          ))}
        </CommandGroup>
      )}
    </>
  );
}
