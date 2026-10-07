import type { ReactNode } from 'react';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { EntityLink } from '@/components/entity-links';
import type { EntityKind } from '@scrolled/game-db/db/types';
import { EntityRow as DesignEntityRow } from '@scrolled/design';
import { useShowEntityIds } from '@/stores/showEntityIds';

interface Props {
  entity: EntityKind;
  id: number;
  /** Primary display name. When null, falls back to "<Entity> #id" italic muted. */
  name: string | null | undefined;
  /** Optional second line shown inline as " · {subtitle}" muted (e.g. street name, quest parent). */
  subtitle?: string | null;
  /** Right-aligned content inside the row link (e.g. "Lvl 47", "×3"). */
  meta?: ReactNode;
  /** Sibling content rendered outside the row link (e.g. a "show on map" pin button). */
  trailing?: ReactNode;
  /** Force-hide the trailing id badge regardless of the global preference
   *  (e.g. on rows whose name already encodes the id). The badge is also
   *  hidden globally when the user has IDs turned off in Settings. */
  hideId?: boolean;
  /** Render the row as a non-link (e.g. when the matching feature is disabled). Default true. */
  linkable?: boolean;
  className?: string;
  /** Replaces the entity sprite, for rows whose entity isn't the best picture (portals). */
  avatar?: ReactNode;
}

/**
 * Standard row for detail-page relation lists: the design EntityRow, with the
 * avatar, name and meta wrapped in the type-appropriate EntityLink. `trailing`
 * sits outside the link for sibling controls (pin buttons, etc.).
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
  avatar,
}: Props) {
  const showIds = useShowEntityIds((s) => s.enabled);
  const displayName = name ?? `${ENTITY_LABEL[entity]} #${id}`;
  const idVisible = !hideId && showIds;
  return (
    <DesignEntityRow
      as="li"
      divider={false}
      interactive={linkable}
      className={className}
      leading={
        avatar ?? (
          <EntityAvatar entity={entity} id={id} alt={typeof name === 'string' ? name : undefined} />
        )
      }
      name={name ? displayName : <span className="text-muted-foreground italic">{displayName}</span>}
      subtitle={subtitle ?? undefined}
      meta={
        meta != null || idVisible ? (
          <>
            {meta != null && <span>{meta}</span>}
            {idVisible && <span className="font-mono">{id}</span>}
          </>
        ) : undefined
      }
      trailing={trailing}
      renderMain={
        linkable
          ? ({ className: mainClass, children }) => (
              <EntityLink entity={entity} id={id} className={mainClass} triggerClassName={mainClass}>
                {children}
              </EntityLink>
            )
          : undefined
      }
    />
  );
}

const ENTITY_LABEL: Record<EntityKind, string> = {
  item: 'Item',
  equip: 'Equip',
  mob: 'Mob',
  npc: 'NPC',
  map: 'Map',
  quest: 'Quest',
  questChain: 'Chain',
  skill: 'Skill',
};
