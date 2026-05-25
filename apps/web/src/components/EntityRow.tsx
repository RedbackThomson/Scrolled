import type { ReactNode } from 'react';
import { EntityAvatar } from '@/components/EntityAvatar';
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
  const linkClass = 'flex min-w-0 items-center gap-3';
  const body = (
    <>
      <EntityAvatar entity={entity} id={id} alt={typeof name === 'string' ? name : undefined} />
      <span className="min-w-0 truncate">
        {name ? displayName : <span className="text-muted-foreground italic">{displayName}</span>}
        {subtitle && <span className="text-muted-foreground"> · {subtitle}</span>}
      </span>
    </>
  );

  const showRightBlock = meta != null || !hideId;

  return (
    <li
      className={cn(
        'group flex items-center gap-3 px-3 py-1.5 text-sm',
        linkable && 'hover:bg-accent',
        className,
      )}
    >
      {linkable ? (
        <EntityLink
          entity={entity}
          id={id}
          className={linkClass}
          triggerClassName={linkClass}
        >
          {body}
        </EntityLink>
      ) : (
        <div className={linkClass}>{body}</div>
      )}
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      {showRightBlock && (
        <div className="text-muted-foreground ml-auto flex shrink-0 items-center gap-3 text-xs">
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

