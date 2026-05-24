import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Map as MapIcon,
  Package,
  ScrollText,
  Search,
  Shield,
  Skull,
  Users,
} from 'lucide-react';
import type { EntityKind } from '@/db';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getDbClient } from '@/db';
import { labelForEquipSlot } from '@/lib/equipTypes';
import { getSearchIndex, querySearch, type SearchHit } from '@/search';
import { cn } from '@/lib/utils';

export function TopBar() {
  return (
    <header className="border-border bg-background sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
      <GlobalSearch />
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}

function routeFor(entity: EntityKind, id: number): string {
  switch (entity) {
    case 'item':
      return `/items/${id}`;
    case 'equip':
      return `/equips/${id}`;
    case 'mob':
      return `/mobs/${id}`;
    case 'npc':
      return `/npcs/${id}`;
    case 'map':
      return `/maps/${id}`;
    case 'quest':
      return `/quests/${id}`;
  }
}

function iconFor(entity: EntityKind) {
  switch (entity) {
    case 'item':
      return Package;
    case 'equip':
      return Shield;
    case 'mob':
      return Skull;
    case 'npc':
      return Users;
    case 'map':
      return MapIcon;
    case 'quest':
      return ScrollText;
  }
}

function GlobalSearch() {
  const navigate = useNavigate();
  const db = useMemo(() => getDbClient(), []);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => db.status(),
  });

  // `epoch` is a stable fingerprint of the DB's entity counts. Any count
  // moving forces the MiniSearch index to rebuild on the next query.
  const counts = statusQ.data?.counts;
  const epoch = counts
    ? `${counts.items}.${counts.equips}.${counts.mobs}.${counts.npcs}.${counts.maps}.${counts.quests}`
    : '';
  const hasContent =
    !!counts &&
    (counts.items > 0 ||
      counts.equips > 0 ||
      counts.mobs > 0 ||
      counts.npcs > 0 ||
      counts.maps > 0 ||
      counts.quests > 0);

  const indexQ = useQuery({
    queryKey: ['search-index', epoch],
    queryFn: () => getSearchIndex(epoch),
    enabled: hasContent,
  });

  const results: SearchHit[] = useMemo(() => {
    if (!indexQ.data || !q.trim()) return [];
    return querySearch(indexQ.data, q);
  }, [indexQ.data, q]);

  useEffect(() => {
    setActiveIdx(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  function go(hit: SearchHit) {
    navigate(routeFor(hit.entity, hit.id));
    setOpen(false);
    setQ('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIdx];
      if (hit) go(hit);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const empty = !hasContent;
  const placeholder = empty
    ? 'Database is empty — extract on /debug'
    : 'Search items, equips, mobs, NPCs, maps, quests…';

  return (
    <div ref={containerRef} className="relative max-w-xl flex-1">
      <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={empty}
        className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60"
        aria-label="Global search"
      />
      {indexQ.isFetching && (
        <Loader2 className="text-muted-foreground absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
      )}
      {open && q.trim() && (
        <div className="border-border bg-card text-card-foreground absolute left-0 right-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-md border shadow-lg">
          {results.length === 0 && (
            <div className="text-muted-foreground p-3 text-sm">No matches.</div>
          )}
          {results.map((hit, i) => {
            const Icon = iconFor(hit.entity);
            return (
              <Link
                key={`${hit.entity}-${hit.id}`}
                to={routeFor(hit.entity, hit.id)}
                onClick={() => {
                  setOpen(false);
                  setQ('');
                }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm',
                  i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                )}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <Icon className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs">{hit.id}</span>
                {hit.category && (
                  <span
                    className={cn(
                      'text-muted-foreground shrink-0 text-xs',
                      hit.entity !== 'equip' && 'capitalize',
                    )}
                  >
                    {hit.entity === 'equip' ? labelForEquipSlot(hit.category) : hit.category}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
