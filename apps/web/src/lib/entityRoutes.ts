import {
  GitBranch,
  Map as MapIcon,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EntityKind } from '@/db';
import type { SavedSearchScope } from '@/db/user';

export function routeForEntity(entity: EntityKind, id: number | string): string {
  switch (entity) {
    case 'item':
      return `/items/${id}`;
    case 'equip':
      return `/equips/${id}`;
    case 'mob':
      return `/mobs/${id}`;
    case 'npc':
      return `/npcs/${id}`;
    case 'map':
      return `/maps/${id}`;
    case 'quest':
      return `/quests/${id}`;
    case 'questChain':
      return `/quest-chains/${id}`;
    case 'skill':
      return `/skills/${id}`;
  }
}

export function listingRouteForEntity(entity: EntityKind): string {
  switch (entity) {
    case 'item':
      return '/items';
    case 'equip':
      return '/equips';
    case 'mob':
      return '/mobs';
    case 'npc':
      return '/npcs';
    case 'map':
      return '/maps';
    case 'quest':
      return '/quests';
    case 'questChain':
      return '/quest-chains';
    case 'skill':
      return '/skills';
  }
}

export function iconForEntity(entity: EntityKind): LucideIcon {
  switch (entity) {
    case 'item':
      return Package;
    case 'equip':
      return Shield;
    case 'mob':
      return Skull;
    case 'npc':
      return Users;
    case 'map':
      return MapIcon;
    case 'quest':
      return ScrollText;
    case 'questChain':
      return GitBranch;
    case 'skill':
      return Sparkles;
  }
}

export function labelForEntityKind(entity: EntityKind, plural = false): string {
  if (plural) {
    return {
      item: 'Items',
      equip: 'Equips',
      mob: 'Mobs',
      npc: 'NPCs',
      map: 'Maps',
      quest: 'Quests',
      questChain: 'Quest Chains',
      skill: 'Skills',
    }[entity];
  }
  return {
    item: 'Item',
    equip: 'Equip',
    mob: 'Mob',
    npc: 'NPC',
    map: 'Map',
    quest: 'Quest',
    questChain: 'Quest Chain',
    skill: 'Skill',
  }[entity];
}

export const ENTITY_KINDS: readonly EntityKind[] = [
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
  'questChain',
  'skill',
] as const;

/** A saved search's list page. Weapons share the equip entity but have their own page. */
export function listingRouteForScope(scope: SavedSearchScope): string {
  return scope === 'weapon' ? '/weapons' : listingRouteForEntity(scope);
}

export function iconForScope(scope: SavedSearchScope): LucideIcon {
  return scope === 'weapon' ? Sword : iconForEntity(scope);
}

export function labelForScope(scope: SavedSearchScope, plural = false): string {
  if (scope === 'weapon') return plural ? 'Weapons' : 'Weapon';
  return labelForEntityKind(scope, plural);
}
