import type { ReactNode } from 'react';
import { DoorOpen } from 'lucide-react';
import type { MapPortalWithName } from '@/db';
import { MapLink } from '@/components/entity-links';

interface Props {
  portal: MapPortalWithName;
  /** Sentinel value the WZ data uses to mean "no map" for target fields. */
  noTargetId: number;
  /** Sibling content rendered to the right of the row (e.g. a "show on map" pin button). */
  trailing?: ReactNode;
}

/**
 * One row in the Portals section on a map detail page. Mirrors EntityRow's
 * three-slot structure (body → trailing → right block) so the optional pin
 * button lands to the left of the coords, like NPC/mob rows. Desktop keeps the
 * compact single-line layout (portalName → MapName · TargetPortal | coords);
 * below `md` the row becomes a card with the destination map on top and the
 * portal's own name + coords on a secondary line.
 */
export function MapPortalRow({ portal, noTargetId, trailing }: Props) {
  const hasTarget = portal.targetMapId !== null && portal.targetMapId !== noTargetId;
  const coords =
    portal.x !== null || portal.y !== null ? `(${portal.x ?? '?'}, ${portal.y ?? '?'})` : null;

  return (
    <li className="group flex min-h-[44px] items-center gap-3 px-3 py-2 text-sm md:min-h-0 md:py-1.5">
      {/* Desktop body (md+). Coords are pulled out into the right block below
       *  so `trailing` can sit between them, matching EntityRow. */}
      <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
        <span className="font-mono text-xs">{portal.portalName}</span>
        <span className="text-muted-foreground">→</span>
        {hasTarget ? (
          <MapLink
            id={portal.targetMapId!}
            className="text-primary min-w-0 flex-1 truncate hover:underline"
          >
            {portal.targetMapName ?? `Map ${portal.targetMapId}`}
            {portal.targetPortal && (
              <span className="text-muted-foreground"> · {portal.targetPortal}</span>
            )}
          </MapLink>
        ) : (
          <span className="text-muted-foreground italic">no target</span>
        )}
      </div>

      {/* Mobile body. Stacked card with map name on top (primary, linked when
       *  there's a destination), portal name + coords on a secondary line —
       *  same shape EntityRow uses when meta is shown on mobile. */}
      <div className="flex min-w-0 flex-1 items-center gap-3 md:hidden">
        <DoorOpen className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate">
            {hasTarget ? (
              <MapLink id={portal.targetMapId!} className="text-primary font-medium hover:underline">
                {portal.targetMapName ?? `Map ${portal.targetMapId}`}
              </MapLink>
            ) : (
              <span className="text-muted-foreground italic">no target</span>
            )}
            {portal.targetPortal && (
              <span className="text-muted-foreground"> · {portal.targetPortal}</span>
            )}
          </div>
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-mono">{portal.portalName}</span>
            {coords && <span className="font-mono">{coords}</span>}
          </div>
        </div>
      </div>

      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}

      {coords && (
        <div className="text-muted-foreground ml-auto hidden shrink-0 items-center gap-3 font-mono text-xs md:flex">
          {coords}
        </div>
      )}
    </li>
  );
}
