import { useMemo, useState, type ReactNode } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import type { WorldMapMarkerWithMaps } from '@/db';
import { MapHoverCard } from '@/components/entity-links';
import { HoverPopover } from '@scrolled/design';
import { useEntitySummaryNames } from '@/hooks/useEntitySummaries';
import { cn, Input } from '@scrolled/design';

interface Props {
  markers: WorldMapMarkerWithMaps[];
  /** The marker selected on the canvas — a region drills in, a single-map
   *  marker just highlights. Cleared with the "x" control. */
  selectedMarkerId: string | null;
  onSelectMarker: (id: string | null) => void;
  /** Transient highlight while hovering a row; pass `null` on mouseleave. */
  onHoverMarker: (id: string | null) => void;
  onNavigateMap: (mapId: number) => void;
}

// A single marker can group thousands of maps; cap the rows we render and let
// search narrow rather than paint an unbounded list.
const MAP_ROW_CAP = 300;

export function WorldMapViewerSidebar({
  markers,
  selectedMarkerId,
  onSelectMarker,
  onHoverMarker,
  onNavigateMap,
}: Props) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  // One batched name lookup for every map referenced on this world map.
  const allMapIds = useMemo(() => {
    const ids = new Set<number>();
    for (const m of markers) for (const id of m.mapIds) ids.add(id);
    return [...ids].sort((a, b) => a - b);
  }, [markers]);
  const mapNameById = useEntitySummaryNames('map', allMapIds);
  const nameFor = (id: number) => mapNameById.get(id) ?? `Map ${id}`;

  // A marker is a "region" only when it groups several maps. A single-map
  // marker is just that map — label it by the map's name, not "Region (1)".
  const isRegion = (m: WorldMapMarkerWithMaps) => m.mapIds.length > 1;
  const labelFor = (m: WorldMapMarkerWithMaps) =>
    m.title ?? (isRegion(m) ? `Region (${m.mapIds.length})` : nameFor(m.mapIds[0]!));
  const matchesMap = (id: number) => nameFor(id).toLowerCase().includes(q) || String(id).includes(q);

  const selected = useMemo(
    () => markers.find((m) => m.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId],
  );
  // Only multi-map markers drill in; a single-map "selection" (e.g. seeded
  // from the focus map) just highlights on the canvas and shows the list.
  const drilling = selected !== null && isRegion(selected);

  const drillMaps = useMemo(() => {
    if (!drilling || !selected) return [];
    const ids = q ? selected.mapIds.filter(matchesMap) : selected.mapIds;
    return ids.map((id) => ({ id, name: nameFor(id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drilling, selected, q, mapNameById]);

  // List view: markers (regions + single maps) matching the query, plus loose
  // matches for maps that live inside a region so they can be found directly.
  const places = useMemo(
    () => (q ? markers.filter((m) => labelFor(m).toLowerCase().includes(q)) : markers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers, q, mapNameById],
  );
  const mapMatches = useMemo(() => {
    if (!q) return [];
    const out: { id: number; name: string; region: string; markerId: string }[] = [];
    for (const m of markers) {
      if (!isRegion(m)) continue; // single maps are already shown in `places`
      for (const id of m.mapIds) {
        if (matchesMap(id)) out.push({ id, name: nameFor(id), region: labelFor(m), markerId: m.id });
        if (out.length >= MAP_ROW_CAP) return out;
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, q, mapNameById]);

  return (
    <aside className="border-border bg-card flex w-[280px] shrink-0 flex-col border-r-2">
      <div className="flex shrink-0 items-center gap-1.5 p-3">
        <label className="bg-muted text-muted-foreground focus-within:ring-primary/30 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-3 focus-within:ring-4">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={drilling ? 'Search maps…' : 'Search maps or regions…'}
            aria-label={drilling ? 'Search maps' : 'Search maps or regions'}
            className="text-foreground placeholder:text-muted-foreground h-full w-full min-w-0 border-0 bg-transparent p-0 text-base font-semibold shadow-none focus-visible:outline-none focus-visible:ring-0 sm:text-[13px]"
          />
        </label>
        {selectedMarkerId && (
          <button
            type="button"
            onClick={() => onSelectMarker(null)}
            aria-label="Clear selection"
            title="Clear selection"
            className="bg-muted text-muted-foreground hover:text-foreground ease-spring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 hover:rotate-90"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {drilling && selected ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="text-muted-foreground flex items-baseline gap-1.5 px-4 pb-2 text-xs font-semibold">
            <span className="font-display text-foreground truncate text-[15px]">
              {labelFor(selected)}
            </span>
            · {selected.mapIds.length} maps
          </div>
          <ul className="flex-1 space-y-px overflow-y-auto px-2 pb-2 text-sm">
            {drillMaps.length === 0 ? (
              <EmptyState label="No maps match" />
            ) : (
              <>
                {drillMaps.slice(0, MAP_ROW_CAP).map((row) => (
                  <Row
                    key={row.id}
                    label={row.name}
                    meta={`#${row.id}`}
                    hoverCard={<MapHoverCard id={row.id} />}
                    onClick={() => onNavigateMap(row.id)}
                    onHoverEnter={() => selected && onHoverMarker(selected.id)}
                    onHoverLeave={() => onHoverMarker(null)}
                  />
                ))}
                {drillMaps.length > MAP_ROW_CAP && (
                  <CapNote shown={MAP_ROW_CAP} total={drillMaps.length} />
                )}
              </>
            )}
          </ul>
        </div>
      ) : (
        <ul className="flex-1 space-y-px overflow-y-auto px-2 pb-2 text-sm">
          {places.length === 0 && mapMatches.length === 0 ? (
            <EmptyState label={q ? 'Nothing matches' : 'No markers'} />
          ) : (
            <>
              {places.map((m) => (
                <Row
                  key={m.id}
                  Icon={MapPin}
                  label={labelFor(m)}
                  meta={isRegion(m) ? `${m.mapIds.length}` : `#${m.mapIds[0]}`}
                  selected={m.id === selectedMarkerId}
                  hoverCard={
                    m.mapIds[0] !== undefined ? <MapHoverCard id={m.mapIds[0]} /> : undefined
                  }
                  onClick={() => onSelectMarker(m.id)}
                  onHoverEnter={() => onHoverMarker(m.id)}
                  onHoverLeave={() => onHoverMarker(null)}
                />
              ))}
              {mapMatches.length > 0 && (
                <li className="text-muted-foreground px-3 pb-1 pt-3 text-[11.5px] font-bold uppercase tracking-[.04em]">
                  Maps in regions
                </li>
              )}
              {mapMatches.map((row) => (
                <Row
                  key={`map-${row.id}`}
                  label={row.name}
                  meta={row.region}
                  hoverCard={<MapHoverCard id={row.id} />}
                  onClick={() => onNavigateMap(row.id)}
                  onHoverEnter={() => onHoverMarker(row.markerId)}
                  onHoverLeave={() => onHoverMarker(null)}
                />
              ))}
            </>
          )}
        </ul>
      )}
    </aside>
  );
}

function Row({
  label,
  meta,
  selected,
  hoverCard,
  onClick,
  onHoverEnter,
  onHoverLeave,
  Icon,
}: {
  label: string;
  meta?: string;
  selected?: boolean;
  hoverCard?: ReactNode;
  onClick: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
  Icon?: typeof MapPin;
}) {
  const labelClass = 'min-w-0 flex-1 truncate';
  const wrappedLabel = hoverCard ? (
    <HoverPopover content={hoverCard} triggerClassName={labelClass}>
      {label}
    </HoverPopover>
  ) : (
    <span className={labelClass}>{label}</span>
  );
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onHoverEnter}
        onMouseLeave={onHoverLeave}
        onFocus={onHoverEnter}
        onBlur={onHoverLeave}
        className={cn(
          'ease-spring focus-visible:ring-primary/30 flex min-h-[46px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[13px] font-semibold transition-[padding,background-color] duration-300 focus-visible:outline-none focus-visible:ring-4',
          selected ? 'bg-muted text-foreground ring-primary/40 ring-2 ring-inset' : 'hover:bg-muted hover:pl-4',
        )}
        aria-pressed={selected}
      >
        {Icon && <Icon className="text-primary h-4 w-4 shrink-0" aria-hidden />}
        {wrappedLabel}
        {meta && (
          <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold">
            {meta}
          </span>
        )}
      </button>
    </li>
  );
}

function CapNote({ shown, total }: { shown: number; total: number }) {
  return (
    <li className="text-muted-foreground px-3 py-3 text-center text-xs">
      Showing {shown} of {total.toLocaleString()} — refine your search.
    </li>
  );
}

function EmptyState({ label }: { label: string }) {
  return <li className="text-muted-foreground px-3 py-6 text-center text-[13px]">{label}</li>;
}
