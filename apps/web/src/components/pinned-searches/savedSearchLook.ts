import type { LucideIcon } from 'lucide-react';
import { ENTITY_HUES } from '@scrolled/design';
import type { PinnedSearchRecord, SavedSearchScope } from '@/db/user';
import { iconForScope } from '@/lib/entityRoutes';
import { COLLECTION_ICONS } from '@/components/collections/iconRegistry';
import { resolveCollectionColor } from '@/components/collections/colorRegistry';

const SCOPE_HUES: Record<SavedSearchScope, number> = {
  item: ENTITY_HUES.item,
  equip: ENTITY_HUES.equip,
  weapon: ENTITY_HUES.equip,
  mob: ENTITY_HUES.mob,
  npc: ENTITY_HUES.npc,
  map: ENTITY_HUES.map,
  quest: ENTITY_HUES.quest,
  questChain: ENTITY_HUES.quest,
  skill: ENTITY_HUES.skill,
};

/** A saved search's tile icon and hue; unset ones follow its list page. */
export function savedSearchLook(s: Pick<PinnedSearchRecord, 'icon' | 'color' | 'entity'>): {
  icon: LucideIcon;
  hue: number;
} {
  const icon = COLLECTION_ICONS.find((o) => o.name === s.icon)?.Icon ?? iconForScope(s.entity);
  return { icon, hue: resolveCollectionColor(s.color).hue ?? SCOPE_HUES[s.entity] };
}
