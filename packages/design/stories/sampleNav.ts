import {
  Bookmark,
  House,
  Map as MapIcon,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react';
import type { SidebarItem } from '../src/components/navigation/Sidebar';

export const SAMPLE_NAV: SidebarItem[] = [
  { key: 'home', icon: House, label: 'Home' },
  { key: 'items', icon: Package, label: 'Items', chevron: true },
  { key: 'equips', icon: Shield, label: 'Equips', chevron: true },
  { key: 'weapons', icon: Swords, label: 'Weapons', chevron: true },
  { key: 'mobs', icon: Skull, label: 'Mobs' },
  { key: 'npcs', icon: Users, label: 'NPCs' },
  { key: 'maps', icon: MapIcon, label: 'Maps' },
  { key: 'quests', icon: ScrollText, label: 'Quests', chevron: true },
  { key: 'skills', icon: Sparkles, label: 'Skills' },
  { key: 'collections', icon: Bookmark, label: 'Collections', chevron: true },
];
