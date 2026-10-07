import { useMemo, useState, type ReactNode } from 'react';
import { DoorOpen, Search, Skull, Users, X, type LucideIcon } from 'lucide-react';
import type { MapMobSpawnWithName, MapNpcWithName, MapPortalRecord } from '@/db';
import { useEntitySummaryNames } from '@/hooks/useEntitySummaries';
import { MobHoverCard, NpcHoverCard } from '@/components/entity-links';
import { HoverPopover } from '@scrolled/design';
import { classifyPortal, type PortalGraph } from '@scrolled/game-db/domain/portal-types';
import { cn } from '@scrolled/design';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { useShowEntityIds } from '@/stores/showEntityIds';
import type { LayerVisibility, MapViewerHighlight } from './types';
import { PortalRow } from './PortalRow';
import { NO_TARGET, PORTAL_LAYER_LABEL } from './portalDisplay';
import { sidebarRowClass } from './rowStyles';

type Tab = 'npcs' | 'mobs' | 'portals';

const TAB_META: Record<Tab, { label: string; Icon: LucideIcon }> = {
  npcs: { label: 'NPCs', Icon: Users },
  mobs: { label: 'Mobs', Icon: Skull },
  portals: { label: 'Portals', Icon: DoorOpen },
};

interface MapViewerSidebarProps {
  mapId: number;
  npcs: MapNpcWithName[];
  mobSpawns: MapMobSpawnWithName[];
  portals: MapPortalRecord[];
  portalGraph: PortalGraph;
  selection: MapViewerHighlight | null;
  onSelect: (sel: MapViewerHighlight | null) => void;
  /** Transient highlight on row hover; pass `null` on mouseleave. */
  onHover: (sel: MapViewerHighlight | null) => void;
  onLayerEnable: (key: keyof LayerVisibility) => void;
}

export function MapViewerSidebar({
  mapId,
  npcs,
  mobSpawns,
  portals,
  portalGraph,
  selection,
  onSelect,
  onHover,
  onLayerEnable,
}: MapViewerSidebarProps) {
  const [tab, setTab] = useState<Tab>(() => {
    if (selection?.kind === 'mob') return 'mobs';
    if (selection?.kind === 'portal') return 'portals';
    return 'npcs';
  });
  const [search, setSearch] = useState('');
  const showIds = useShowEntityIds((s) => s.enabled);

  // Dedupe NPCs / mobs by id, with spawn-position counts.
  const npcRows = useMemo(() => {
    const m = new Map<number, { id: number; name: string; count: number }>();
    for (const n of npcs) {
      const cur = m.get(n.npcId);
      if (cur) cur.count += 1;
      else m.set(n.npcId, { id: n.npcId, name: n.name ?? `NPC ${n.npcId}`, count: 1 });
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [npcs]);

  const mobRows = useMemo(() => {
    const m = new Map<number, { id: number; name: string; level: number | null; count: number }>();
    for (const s of mobSpawns) {
      const cur = m.get(s.mobId);
      if (cur) cur.count += 1;
      else
        m.set(s.mobId, {
          id: s.mobId,
          name: s.name ?? `Mob ${s.mobId}`,
          level: s.level,
          count: 1,
        });
    }
    return [...m.values()].sort((a, b) => {
      const la = a.level ?? Infinity;
      const lb = b.level ?? Infinity;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name);
    });
  }, [mobSpawns]);

  // Attach a 1-based counter to each spawn-type portal so duplicate `sp`
  // entries can be distinguished in the sidebar list ("Player spawn 1",
  // "Player spawn 2", …). For maps with a single spawn the counter is null
  // and the label is just "Player spawn".
  const portalRows = useMemo(() => {
    const classified = portals.map((p) => ({
      portal: p,
      layer: classifyPortal(p, mapId),
    }));
    const spawnTotal = classified.filter((r) => r.layer === 'spawn').length;
    let seen = 0;
    return classified.map((r) => {
      let spawnCounter: number | null = null;
      if (r.layer === 'spawn' && spawnTotal > 1) {
        seen += 1;
        spawnCounter = seen;
      }
      return { ...r, spawnCounter };
    });
  }, [portals, mapId]);

  // Batch-fetch display names for every target map referenced by an external
  // portal. Cached per (sorted) id-set so re-renders don't re-issue. The
  // sidebar row uses the map name as its primary label.
  const targetMapIds = useMemo(() => {
    const ids = new Set<number>();
    for (const r of portalRows) {
      const tm = r.portal.targetMapId;
      if (r.layer === 'portal' && tm !== null && tm !== NO_TARGET && tm !== mapId) {
        ids.add(tm);
      }
    }
    return [...ids].sort((a, b) => a - b);
  }, [portalRows, mapId]);
  const mapNameById = useEntitySummaryNames('map', targetMapIds);

  const q = search.trim().toLowerCase();

  const filteredNpcs = q ? npcRows.filter((r) => r.name.toLowerCase().includes(q)) : npcRows;
  const filteredMobs = q ? mobRows.filter((r) => r.name.toLowerCase().includes(q)) : mobRows;
  const filteredPortals = q
    ? portalRows.filter((r) => {
        if (r.portal.portalName.toLowerCase().includes(q)) return true;
        if (PORTAL_LAYER_LABEL[r.layer].toLowerCase().includes(q)) return true;
        const tm = r.portal.targetMapId;
        if (tm !== null && tm !== NO_TARGET) {
          const name = mapNameById.get(tm);
          if (name && name.toLowerCase().includes(q)) return true;
        }
        return false;
      })
    : portalRows;

  const handleTab = (next: Tab) => {
    setTab(next);
    // Auto-enable the matching layer(s) so a click in the sidebar doesn't
    // produce an "empty highlight" against a hidden layer.
    if (next === 'npcs') onLayerEnable('npcs');
    if (next === 'mobs') onLayerEnable('mobs');
    if (next === 'portals') {
      onLayerEnable('portals');
      onLayerEnable('spawns');
      onLayerEnable('teleports');
    }
  };

  const handleSelectNpc = (id: number) => {
    if (selection?.kind === 'npc' && selection.key === String(id)) onSelect(null);
    else onSelect({ kind: 'npc', key: String(id) });
  };
  const handleSelectMob = (id: number) => {
    if (selection?.kind === 'mob' && selection.key === String(id)) onSelect(null);
    else onSelect({ kind: 'mob', key: String(id) });
  };
  const handleSelectPortal = (idx: number) => {
    const key = String(idx);
    if (selection?.kind === 'portal' && selection.key === key) onSelect(null);
    else onSelect({ kind: 'portal', key });
  };

  return (
    <aside className="border-muted bg-card flex w-[290px] shrink-0 flex-col gap-3 border-r-2 p-3 max-md:w-full max-md:border-r-0">
      <div className="bg-muted flex shrink-0 gap-0.5 rounded-md p-[3px]" role="tablist">
        {(['npcs', 'mobs', 'portals'] as const).map((t) => {
          const meta = TAB_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => handleTab(t)}
              className={cn(
                'focus-visible:ring-primary/50 flex flex-1 items-center justify-center gap-1.5 rounded-[9px] px-2 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2',
                active
                  ? 'bg-card text-foreground shadow-float'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <meta.Icon className="h-3.5 w-3.5" aria-hidden />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <label className="bg-muted text-muted-foreground focus-within:ring-primary/30 flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full px-3 focus-within:ring-4">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${TAB_META[tab].label}`}
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-base outline-none sm:text-[13px]"
          />
        </label>
        {selection && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Clear selection"
            title="Clear selection"
            className="bg-muted text-muted-foreground hover:text-foreground focus-visible:ring-primary/50 ease-spring inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform duration-300 hover:rotate-90 focus-visible:outline-none focus-visible:ring-2"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <ul className="-mx-1 flex flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {tab === 'npcs' &&
          (filteredNpcs.length === 0 ? (
            <EmptyState label="No NPCs" />
          ) : (
            filteredNpcs.map((r) => (
              <SidebarRow
                key={r.id}
                leading={<EntityAvatar entity="npc" id={r.id} size={28} />}
                label={r.name}
                count={r.count}
                selected={selection?.kind === 'npc' && selection.key === String(r.id)}
                onClick={() => handleSelectNpc(r.id)}
                onHoverEnter={() => onHover({ kind: 'npc', key: String(r.id) })}
                onHoverLeave={() => onHover(null)}
                meta={showIds ? `#${r.id}` : undefined}
                hoverCard={<NpcHoverCard id={r.id} />}
              />
            ))
          ))}

        {tab === 'mobs' &&
          (filteredMobs.length === 0 ? (
            <EmptyState label="No mobs" />
          ) : (
            filteredMobs.map((r) => (
              <SidebarRow
                key={r.id}
                leading={<EntityAvatar entity="mob" id={r.id} size={28} />}
                label={r.name}
                count={r.count}
                selected={selection?.kind === 'mob' && selection.key === String(r.id)}
                onClick={() => handleSelectMob(r.id)}
                onHoverEnter={() => onHover({ kind: 'mob', key: String(r.id) })}
                onHoverLeave={() => onHover(null)}
                meta={
                  r.level !== null ? `Lvl ${r.level}` : showIds ? `#${r.id}` : undefined
                }
                hoverCard={<MobHoverCard id={r.id} />}
              />
            ))
          ))}

        {tab === 'portals' &&
          (filteredPortals.length === 0 ? (
            <EmptyState label="No portals" />
          ) : (
            filteredPortals.map((r) => (
              <PortalRow
                key={r.portal.idx}
                portal={r.portal}
                layer={r.layer}
                spawnCounter={r.spawnCounter}
                linkedToName={portalGraph.forwardNames.get(r.portal.idx)?.[0] ?? null}
                selected={selection?.kind === 'portal' && selection.key === String(r.portal.idx)}
                onClick={() => handleSelectPortal(r.portal.idx)}
                onHoverEnter={() => onHover({ kind: 'portal', key: String(r.portal.idx) })}
                onHoverLeave={() => onHover(null)}
                mapName={
                  r.portal.targetMapId !== null && r.portal.targetMapId !== NO_TARGET
                    ? (mapNameById.get(r.portal.targetMapId) ?? null)
                    : null
                }
              />
            ))
          ))}
      </ul>
    </aside>
  );
}

function SidebarRow({
  leading,
  label,
  count,
  selected,
  onClick,
  onHoverEnter,
  onHoverLeave,
  meta,
  mono,
  hoverCard,
}: {
  leading: ReactNode;
  label: ReactNode;
  count?: number;
  selected: boolean;
  onClick: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
  meta?: string;
  mono?: boolean;
  hoverCard?: ReactNode;
}) {
  const labelClass = cn('min-w-0 flex-1 truncate', mono && 'font-mono');
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
        className={sidebarRowClass(selected)}
        aria-pressed={selected}
      >
        {leading}
        {wrappedLabel}
        {count !== undefined && count > 1 && (
          <span className="text-muted-foreground shrink-0 text-[11.5px] font-medium">×{count}</span>
        )}
        {meta && (
          <span className="text-muted-foreground shrink-0 text-[11.5px] font-medium">{meta}</span>
        )}
      </button>
    </li>
  );
}

function EmptyState({ label }: { label: string }) {
  return <li className="text-muted-foreground px-3 py-6 text-center text-[13px]">{label}</li>;
}
