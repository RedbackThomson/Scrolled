// Curated icon set for collections. Stored as the icon `name` (a stable
// kebab-case string) in the DB so future icon additions don't invalidate
// existing rows. Unknown names fall back to the default — no consumer
// has to handle missing icons.

import {
  Bookmark,
  Coins,
  Crown,
  Flame,
  Heart,
  Map as MapIcon,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Star,
  Sword,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface CollectionIconOption {
  name: string;
  label: string;
  Icon: LucideIcon;
}

export const COLLECTION_ICONS: readonly CollectionIconOption[] = [
  { name: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { name: 'star', label: 'Star', Icon: Star },
  { name: 'heart', label: 'Heart', Icon: Heart },
  { name: 'trophy', label: 'Trophy', Icon: Trophy },
  { name: 'flame', label: 'Flame', Icon: Flame },
  { name: 'crown', label: 'Crown', Icon: Crown },
  { name: 'sword', label: 'Sword', Icon: Sword },
  { name: 'shield', label: 'Shield', Icon: Shield },
  { name: 'package', label: 'Package', Icon: Package },
  { name: 'coins', label: 'Coins', Icon: Coins },
  { name: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { name: 'target', label: 'Target', Icon: Target },
  { name: 'map', label: 'Map', Icon: MapIcon },
  { name: 'skull', label: 'Skull', Icon: Skull },
  { name: 'users', label: 'Users', Icon: Users },
  { name: 'scroll-text', label: 'Scroll', Icon: ScrollText },
] as const;

export const DEFAULT_COLLECTION_ICON: CollectionIconOption = COLLECTION_ICONS[0];

const ICON_BY_NAME = new Map<string, CollectionIconOption>(
  COLLECTION_ICONS.map((o) => [o.name, o]),
);

/** Resolve a stored icon name to a Lucide component, falling back to the
 *  default for unknown / null values. */
export function resolveCollectionIcon(name: string | null | undefined): CollectionIconOption {
  if (!name) return DEFAULT_COLLECTION_ICON;
  return ICON_BY_NAME.get(name) ?? DEFAULT_COLLECTION_ICON;
}
