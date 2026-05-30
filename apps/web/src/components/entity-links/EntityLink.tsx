import type { ReactNode } from 'react';
import { EquipLink } from './EquipLink';
import { ItemLink } from './ItemLink';
import { MapLink } from './MapLink';
import { MobLink } from './MobLink';
import { NpcLink } from './NpcLink';
import { QuestLink } from './QuestLink';
import { QuestChainLink } from './QuestChainLink';
import { SkillLink } from './SkillLink';
import type { EntityKind } from '@/db/types';

interface Props {
  entity: EntityKind;
  id: number;
  children: ReactNode;
  className?: string;
  /** Applied to the HoverPopover wrapper span — needed when the link must
   *  grow inside a flex row (e.g. `flex min-w-0 flex-1`). */
  triggerClassName?: string;
  /** Skip the hover preview popover (e.g. when the row already shows the
   *  same info). */
  noPreview?: boolean;
}

/**
 * Dispatches to the type-specific EntityLink. Use this instead of
 * branching on entity at every call site.
 */
export function EntityLink({
  entity,
  id,
  children,
  className,
  triggerClassName,
  noPreview,
}: Props) {
  switch (entity) {
    case 'item':
      return (
        <ItemLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </ItemLink>
      );
    case 'equip':
      return (
        <EquipLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </EquipLink>
      );
    case 'mob':
      return (
        <MobLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </MobLink>
      );
    case 'npc':
      return (
        <NpcLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </NpcLink>
      );
    case 'map':
      return (
        <MapLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </MapLink>
      );
    case 'quest':
      return (
        <QuestLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </QuestLink>
      );
    case 'questChain':
      return (
        <QuestChainLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </QuestChainLink>
      );
    case 'skill':
      return (
        <SkillLink
          id={id}
          className={className}
          triggerClassName={triggerClassName}
          noPreview={noPreview}
        >
          {children}
        </SkillLink>
      );
  }
}
