import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { getDbClient, type EntityKind } from '@/db';
import { getSearchIndex, querySearch, type SearchHit } from '@/search';
import { iconForEntity, labelForEntityKind, routeForEntity } from '@/lib/entityRoutes';
import { labelForEquipSlot } from '@/domain/equipTypes';
import { useRecentQueries } from '@/lib/recents';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { useFeatures } from '@/hooks/useFeatures';

const PREFIX_TO_ENTITY: Record<string, EntityKind> = {
  m: 'mob',
  i: 'item',
  e: 'equip',
  n: 'npc',
  mp: 'map',
  q: 'quest',
};

interface ParsedQuery {
  scope: EntityKind | null;
  rest: string;
}

export function parseScopedQuery(raw: string): ParsedQuery {
  const trimmed = raw.trimStart();
  const space = trimmed.indexOf(' ');
  if (space === -1) return { scope: null, rest: trimmed };
  const head = trimmed.slice(0, space).toLowerCase();
  const scope = PREFIX_TO_ENTITY[head];
  if (!scope) return { scope: null, rest: trimmed };
  return { scope, rest: trimmed.slice(space + 1).trimStart() };
}

export function GlobalSearchProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const features = useFeatures();
  const db = useMemo(() => getDbClient(), []);
  const recentQueries = useRecentQueries();

  const counts = features.counts;
  const epoch = counts
    ? `${counts.items}.${counts.equips}.${counts.mobs}.${counts.npcs}.${counts.maps}.${counts.quests}`
    : '';

  const indexQ = useQuery({
    queryKey: ['search-index', epoch],
    queryFn: () => getSearchIndex(epoch),
    enabled: features.hasAny,
  });

  const { scope, rest } = parseScopedQuery(query);
  const trimmed = rest.trim();

  const idHitsQ = useQuery({
    queryKey: ['palette', 'id-lookup', trimmed],
    queryFn: async () => {
      const id = Number(trimmed);
      if (!Number.isFinite(id) || id <= 0) return [];
      const kinds: EntityKind[] = scope ? [scope] : ['item', 'equip', 'mob', 'npc', 'map', 'quest'];
      const results = await Promise.all(
        kinds.map((k) => db.getEntitySummariesByIds(k, [id]).then((rows) => ({ kind: k, rows }))),
      );
      return results.flatMap(({ kind, rows }) =>
        rows.map((r) => ({
          entity: kind,
          id: r.id,
          name: r.name ?? `${labelForEntityKind(kind)} ${r.id}`,
        })),
      );
    },
    enabled: /^\d+$/.test(trimmed),
    staleTime: 30_000,
  });

  const textHits: SearchHit[] = useMemo(() => {
    if (!indexQ.data || !trimmed || /^\d+$/.test(trimmed)) return [];
    const hits = querySearch(indexQ.data, trimmed, 24);
    return scope ? hits.filter((h) => h.entity === scope) : hits;
  }, [indexQ.data, trimmed, scope]);

  const isNumeric = /^\d+$/.test(trimmed);

  if (!trimmed) return null;

  const rows = isNumeric
    ? (idHitsQ.data ?? []).map((r) => ({
        entity: r.entity,
        id: r.id,
        name: r.name,
        category: null as string | null,
      }))
    : textHits.slice(0, 12);

  if (rows.length === 0) return null;

  return (
    <CommandGroup heading={scope ? `${labelForEntityKind(scope, true)} matching` : 'Results'}>
      {rows.map((hit) => {
        const Icon = iconForEntity(hit.entity);
        const subtitle =
          hit.category != null
            ? hit.entity === 'equip'
              ? labelForEquipSlot(hit.category)
              : hit.category
            : null;
        return (
          <CommandItemPrimitive
            key={`hit-${hit.entity}-${hit.id}`}
            value={`hit-${hit.entity}-${hit.id}`}
            keywords={[hit.name, String(hit.id), hit.entity]}
            onSelect={() => {
              if (trimmed.length >= 2) recentQueries.track(trimmed);
              navigate(routeForEntity(hit.entity, hit.id));
              setOpen(false);
            }}
          >
            <Icon className="text-muted-foreground h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{hit.name}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-xs">{hit.id}</span>
            {subtitle && <span className="text-muted-foreground shrink-0 text-xs">{subtitle}</span>}
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
