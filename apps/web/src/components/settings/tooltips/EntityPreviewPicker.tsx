import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@scrolled/ui';
import { getSearchIndex, querySearch } from '@/search';
import { useFeatures } from '@/hooks/useFeatures';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { labelForEntityKind } from '@/lib/entityRoutes';
import type { EntityKind } from '@/db';

export function EntityPreviewPicker({
  entity,
  onChange,
}: {
  entity: EntityKind;
  onChange: (id: number) => void;
}) {
  const [query, setQuery] = useState('');
  const features = useFeatures();
  const counts = features.counts;
  const epoch = counts
    ? `${counts.items}.${counts.equips}.${counts.mobs}.${counts.npcs}.${counts.maps}.${counts.quests}.${counts.questChains}.${counts.skills}.${counts.jobs}`
    : '';

  const indexQ = useQuery({
    queryKey: ['search-index', epoch],
    queryFn: () => getSearchIndex(epoch),
    enabled: features.hasAny,
  });

  const trimmed = query.trim();
  const hits = useMemo(() => {
    if (!indexQ.data || !trimmed) return [];
    return querySearch(indexQ.data, trimmed, 40)
      .filter((h) => h.entity === entity)
      .slice(0, 8);
  }, [indexQ.data, trimmed, entity]);

  return (
    <div className="space-y-1.5">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${labelForEntityKind(entity, true).toLowerCase()} to preview…`}
        className="border-border bg-background w-full rounded-md border px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
      />
      {hits.length > 0 && (
        <ul className="border-border bg-card divide-border divide-y overflow-hidden rounded-md border">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(hit.id);
                  setQuery('');
                }}
                className="hover:bg-muted flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm"
              >
                <EntityAvatar entity={entity} id={hit.id} size={20} alt={hit.name} />
                <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">{hit.id}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
