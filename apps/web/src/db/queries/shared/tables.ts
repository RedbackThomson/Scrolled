import type { EntityKind } from '../../types';

export const ENTITY_TABLES: Record<EntityKind, string> = {
  item: 'items',
  equip: 'equips',
  mob: 'mobs',
  npc: 'npcs',
  map: 'maps',
  quest: 'quests',
};
