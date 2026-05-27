import { useMemo, useState, type ReactNode } from 'react';
import { DoorOpen, Repeat, Skull, Sparkles, Users, X, type LucideIcon } from 'lucide-react';
import type { MapMobSpawnWithName, MapNpcWithName, MapPortalRecord } from '@/db';
import { useEntitySummaryNames } from '@/hooks/useEntitySummaries';
import { MapHoverCard, MobHoverCard, NpcHoverCard } from '@/components/entity-links';
import { HoverPopover } from '@/components/common/HoverPopover';
import { classifyPortal, type PortalGraph, type PortalLayer } from '@/domain/portal-types';
import { cn } from '@/lib/utils';
import type { LayerVisibility, MapViewerHighlight } from './types';

const NO_TARGET = 999999999;

type Tab = 'npcs' | 'mobs' | 'portals';

const TAB_META: Record<Tab, { label: string; Icon: LucideIcon }> = {
  npcs: { label: 'NPCs', Icon: Users },
  mobs: { label: 'Mobs', Icon: Skull },
  portals: { label: 'Portals', Icon: DoorOpen },
};

const PORTAL_LAYER_LABEL: Record<PortalLayer, string> = {
  spawn: 'Spawn',
  portal: 'Portal',
  internalTeleport: 'Teleport',
  unknown: 'Portal',
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
    <aside className="border-border bg-card flex w-72 shrink-0 flex-col border-r">
      <div className="border-border flex shrink-0 border-b" role="tablist">
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
                'flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium',
                active
                  ? 'text-foreground border-primary border-b-2'
                  : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent',
              )}
            >
              <meta.Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="border-border flex shrink-0 items-center gap-1.5 border-b px-2 py-1.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="border-input bg-background focus-visible:ring-ring h-7 w-full rounded-md border px-2 text-xs focus-visible:outline-none focus-visible:ring-1"
        />
        {selection && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-label="Clear selection"
            title="Clear selection"
            className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ul className="flex-1 overflow-y-auto text-sm">
        {tab === 'npcs' &&
          (filteredNpcs.length === 0 ? (
            <EmptyState label="No NPCs" />
          ) : (
            filteredNpcs.map((r) => (
              <SidebarRow
                key={r.id}
                label={r.name}
                count={r.count}
                selected={selection?.kind === 'npc' && selection.key === String(r.id)}
                onClick={() => handleSelectNpc(r.id)}
                onHoverEnter={() => onHover({ kind: 'npc', key: String(r.id) })}
                onHoverLeave={() => onHover(null)}
                meta={`#${r.id}`}
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
                label={r.name}
                count={r.count}
                selected={selection?.kind === 'mob' && selection.key === String(r.id)}
                onClick={() => handleSelectMob(r.id)}
                onHoverEnter={() => onHover({ kind: 'mob', key: String(r.id) })}
                onHoverLeave={() => onHover(null)}
                meta={r.level !== null ? `Lv ${r.level}` : `#${r.id}`}
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
        className={cn(
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
          selected ? 'bg-accent text-foreground' : 'hover:bg-accent/50',
        )}
        aria-pressed={selected}
      >
        {wrappedLabel}
        {count !== undefined && count > 1 && (
          <span className="text-muted-foreground shrink-0 text-[10px]">×{count}</span>
        )}
        {meta && <span className="text-muted-foreground shrink-0 text-[10px]">{meta}</span>}
      </button>
    </li>
  );
}

interface PortalRowProps {
  portal: MapPortalRecord;
  layer: PortalLayer;
  /** 1-based counter shown next to the label when the map has multiple
   *  spawn portals. Null otherwise. */
  spawnCounter: number | null;
  /** Resolved `tn` for same-map teleports (the pn of the portal this one
   *  links to). Null if it doesn't link or the target isn't resolvable. */
  linkedToName: string | null;
  selected: boolean;
  onClick: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
  /** Display name for the portal's target map, or null if unknown/not applicable. */
  mapName: string | null;
}

// Portal rows show the destination as their primary label rather than the WZ
// portal name (`up0`, `west00`, …) which is meaningless to most users.
//
//   spawn             → "Player spawn"
//   external portal   → target map name with a `MapHoverCard` on hover
//   internal teleport → "Same map" with a repeat icon (doesn't change maps)
//   unknown           → mono portal name as a fallback
function PortalRow({
  portal,
  layer,
  spawnCounter,
  linkedToName,
  selected,
  onClick,
  onHoverEnter,
  onHoverLeave,
  mapName,
}: PortalRowProps) {
  const tm = portal.targetMapId;
  const targetIsExternal = layer === 'portal' && tm !== null && tm !== NO_TARGET;

  let labelContent: ReactNode;
  let labelClass = 'min-w-0 flex-1 truncate';
  if (layer === 'spawn') {
    labelContent = (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 italic">
        <Sparkles className="h-3 w-3 shrink-0 text-emerald-500" />
        Player spawn
        {spawnCounter !== null && <span className="font-mono">{spawnCounter}</span>}
      </span>
    );
  } else if (layer === 'internalTeleport') {
    // When we can resolve `tn` to a portal in the same map, show the link
    // ("Same map -> foo"). For unresolved / scripted teleports we just
    // signal that no map change happens.
    labelContent = (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 italic">
        <Repeat className="h-3 w-3 shrink-0 text-violet-500" />
        {linkedToName ? (
          <>
            Same map
            <span className="text-foreground/70">→</span>
            <span className="text-foreground/90 font-mono not-italic">{linkedToName}</span>
          </>
        ) : (
          'Same map'
        )}
      </span>
    );
  } else if (targetIsExternal) {
    labelContent = mapName ?? `Map ${tm}`;
  } else {
    // Unknown classification — fall back to the raw portal name in mono.
    labelContent = portal.portalName;
    labelClass = cn(labelClass, 'font-mono');
  }

  // The label's wrapping span must be a *direct* flex child of the button
  // for `flex-1` (which pushes the meta to the right) to take effect. When
  // the label is wrapped in HoverPopover, the popover's trigger span IS
  // that direct child, so we apply `labelClass` to it via triggerClassName
  // instead of nesting another span inside.
  const wrappedLabel = targetIsExternal ? (
    <HoverPopover content={<MapHoverCard id={tm} />} triggerClassName={labelClass}>
      {labelContent}
    </HoverPopover>
  ) : (
    <span className={labelClass}>{labelContent}</span>
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
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
          selected ? 'bg-accent text-foreground' : 'hover:bg-accent/50',
        )}
        aria-pressed={selected}
        title={portal.portalName}
      >
        {wrappedLabel}
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {PORTAL_LAYER_LABEL[layer]}
        </span>
      </button>
    </li>
  );
}

function EmptyState({ label }: { label: string }) {
  return <li className="text-muted-foreground px-3 py-4 text-center text-xs italic">{label}</li>;
}
