import type { ReactNode } from 'react';
import { Repeat, Sparkles } from 'lucide-react';
import { MapHoverCard } from '@/components/entity-links';
import { HoverPopover } from '@/components/common/HoverPopover';
import type { PortalLayer } from '@/domain/portal-types';
import type { MapPortalRecord } from '@/db';
import { cn } from '@/lib/utils';
import { NO_TARGET, PORTAL_LAYER_LABEL } from './portalDisplay';

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
export function PortalRow({
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
