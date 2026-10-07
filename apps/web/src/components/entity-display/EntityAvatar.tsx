import {
  GitBranch,
  Map as MapIcon,
  ScrollText,
  Skull,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { ItemIcon } from '@/components/entity-display/ItemIcon';
import type { EntityKind } from '@scrolled/game-db/db/types';
import { inventoryCategoryOf } from '@scrolled/game-db/domain/itemCategory';
import { ENTITY_HUES, SlotTile, type SlotTint } from '@scrolled/design';

interface Props {
  entity: EntityKind;
  id: number;
  /** Square slot dimension in px; the sprite fills ~84% of it. Default 36 (relation-list size). */
  size?: number;
  /** Radial highlight behind the sprite, for page headers. */
  spotlight?: boolean;
  rimmed?: boolean;
  alt?: string;
}

const ITEM_TINT: Record<string, SlotTint> = {
  equip: 'equip',
  use: 'use',
  etc: 'etc',
  cash: 'cash',
};

/**
 * Single source of truth for entity-type → slot tile. Items and equips sit on
 * their inventory tint, mobs on the mob tint, and everything else on its entity
 * hue. Maps and quests have no stored sprite, so they show a glyph instead.
 */
export function EntityAvatar({ entity, id, size = 36, spotlight, rimmed, alt }: Props) {
  const tile = { size, spotlight, rimmed };
  const sprite = Math.round(size * 0.84);
  const sprited = (icon: 'mob' | 'npc' | 'map-mark' | 'skill', placeholder: LucideIcon) => (
    <EntityIcon
      entity={icon}
      id={id}
      size={sprite}
      placeholder={placeholder}
      alt={alt}
      className="bg-transparent"
    />
  );

  switch (entity) {
    case 'item':
    case 'equip':
      return (
        <SlotTile {...tile} tint={ITEM_TINT[inventoryCategoryOf(id) ?? ''] ?? 'neutral'}>
          <ItemIcon entity={entity} id={id} size={sprite} alt={alt} className="bg-transparent" />
        </SlotTile>
      );
    case 'mob':
      return (
        <SlotTile {...tile} tint="mob">
          {sprited('mob', Skull)}
        </SlotTile>
      );
    case 'npc':
      return (
        <SlotTile {...tile} hue={ENTITY_HUES.npc}>
          {sprited('npc', Users)}
        </SlotTile>
      );
    case 'map':
      return (
        <SlotTile {...tile} hue={ENTITY_HUES.map}>
          {sprited('map-mark', MapIcon)}
        </SlotTile>
      );
    case 'skill':
      return (
        <SlotTile {...tile} hue={ENTITY_HUES.skill}>
          {sprited('skill', Sparkles)}
        </SlotTile>
      );
    case 'quest':
      return <SlotTile {...tile} hue={ENTITY_HUES.quest} icon={ScrollText} />;
    case 'questChain':
      return <SlotTile {...tile} hue={ENTITY_HUES.quest} icon={GitBranch} />;
  }
}
