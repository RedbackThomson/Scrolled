import type { ReactNode } from 'react';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { EntityLink } from '@/components/entity-links';
import type { EntityKind } from '@/db/types';
import { cn } from '@/lib/utils';

interface Props {
  entity: EntityKind;
  id: number;
  /** Primary display name. When null, falls back to "<Entity> #id" italic muted. */
  name: string | null | undefined;
  /** Optional second line shown inline as " · {subtitle}" muted (e.g. street name, quest parent). */
  subtitle?: string | null;
  /** Right-aligned content inside the row link (e.g. "Lv 47", "×3"). */
  meta?: ReactNode;
  /** Sibling content rendered outside the row link (e.g. a "show on map" pin button). */
  trailing?: ReactNode;
  /** Hide the trailing id badge (default false). */
  hideId?: boolean;
  /** Render the row as a non-link (e.g. when the matching feature is disabled). Default true. */
  linkable?: boolean;
  className?: string;
}

/**
 * Standard row for detail-page relation lists. Wraps avatar + name + meta + id
 * in the type-appropriate EntityLink; an optional `trailing` slot sits outside
 * the link for sibling interactive elements (pin buttons, etc.).
 */
export function EntityRow({
  entity,
  id,
  name,
  subtitle,
  meta,
  trailing,
  hideId,
  linkable = true,
  className,
}: Props) {
  const displayName = name ?? `${ENTITY_LABEL[entity]} #${id}`;
  const linkClass = 'flex min-w-0 flex-1 items-center gap-3';
  const showRightBlock = meta != null || !hideId;
  const body = (
    <>
      <EntityAvatar entity={entity} id={id} alt={typeof name === 'string' ? name : undefined} />
      <div className="min-w-0 flex-1">
        <div className="truncate">
          {name ? (
            displayName
          ) : (
            <span className="text-muted-foreground italic">{displayName}</span>
          )}
          {subtitle && <span className="text-muted-foreground"> · {subtitle}</span>}
        </div>
        {/* Phone viewports don't have room for a right-aligned meta block, so
         *  stack meta + id under the name. Hidden from md up — the desktop
         *  right block below renders them inline instead. */}
        {showRightBlock && (
          <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs md:hidden">
            {meta != null && <span>{meta}</span>}
            {!hideId && <span className="font-mono">{id}</span>}
          </div>
        )}
      </div>
    </>
  );

  return (
    <li
      className={cn(
        // Slightly taller hit area on touch so rows meet the iOS 44 px guideline.
        'group flex min-h-[44px] items-center gap-3 px-3 py-2 text-sm md:min-h-0 md:py-1.5',
        linkable && 'hover:bg-accent',
        className,
      )}
    >
      {linkable ? (
        <EntityLink entity={entity} id={id} className={linkClass} triggerClassName={linkClass}>
          {body}
        </EntityLink>
      ) : (
        <div className={linkClass}>{body}</div>
      )}
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      {showRightBlock && (
        <div className="text-muted-foreground ml-auto hidden shrink-0 items-center gap-3 text-xs md:flex">
          {meta != null && <span>{meta}</span>}
          {!hideId && <span className="font-mono">{id}</span>}
        </div>
      )}
    </li>
  );
}

const ENTITY_LABEL: Record<EntityKind, string> = {
  item: 'Item',
  equip: 'Equip',
  mob: 'Mob',
  npc: 'NPC',
  map: 'Map',
  quest: 'Quest',
};
