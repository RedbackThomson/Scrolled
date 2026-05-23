import { NavLink } from 'react-router-dom';
import {
  Package,
  Shield,
  Skull,
  Users,
  Map as MapIcon,
  ScrollText,
  Home,
  Settings as SettingsIcon,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useFeatures } from '@/lib/useFeatures';
import { cn } from '@/lib/utils';

interface SidebarSection {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: { label: string; to: string }[];
  /** Which feature flag must be true for this entry to render. Always-visible
   *  entries (Home, Settings, Debug, Quests placeholder) omit this. */
  feature?: 'hasItems' | 'hasEquips' | 'hasMobs' | 'hasNpcs' | 'hasMaps';
}

const ENTITY_SECTIONS: SidebarSection[] = [
  {
    label: 'Items',
    to: '/items',
    icon: Package,
    feature: 'hasItems',
    children: [
      { label: 'Use', to: '/items?category=use' },
      { label: 'Setup', to: '/items?category=setup' },
      { label: 'Etc', to: '/items?category=etc' },
      { label: 'Cash', to: '/items?category=cash' },
    ],
  },
  {
    label: 'Equips',
    to: '/equips',
    icon: Shield,
    feature: 'hasEquips',
    children: [
      { label: 'Weapons', to: '/equips?slot=weapon' },
      { label: 'Armor', to: '/equips?slot=armor' },
      { label: 'Accessories', to: '/equips?slot=accessory' },
    ],
  },
  { label: 'Mobs', to: '/mobs', icon: Skull, feature: 'hasMobs' },
  { label: 'NPCs', to: '/npcs', icon: Users, feature: 'hasNpcs' },
  { label: 'Maps', to: '/maps', icon: MapIcon, feature: 'hasMaps' },
];

export function Sidebar() {
  const features = useFeatures();

  const entitySections = ENTITY_SECTIONS.filter((s) => !s.feature || features[s.feature]);

  return (
    <aside className="bg-sidebar text-sidebar-foreground border-border hidden w-60 shrink-0 border-r md:flex md:flex-col">
      <div className="border-border flex h-14 items-center gap-2 border-b px-4">
        <div className="bg-primary text-primary-foreground flex h-7 w-7 items-center justify-center rounded font-bold">
          M
        </div>
        <span className="font-semibold tracking-tight">Mushroom</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          <NavItem to="/" icon={Home} label="Home" end />
          {entitySections.map((section) => (
            <li key={section.to}>
              <NavLink
                to={section.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground',
                  )
                }
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </NavLink>
              {section.children && (
                <ul className="border-border ml-6 mt-1 space-y-0.5 border-l pl-3">
                  {section.children.map((child) => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) =>
                          cn(
                            'block rounded px-2 py-1 text-xs transition-colors',
                            isActive
                              ? 'text-foreground'
                              : 'text-sidebar-muted hover:text-foreground',
                          )
                        }
                      >
                        {child.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {/* Quests stays as a placeholder until Phase 5; not gated on data. */}
          <NavItem to="/quests" icon={ScrollText} label="Quests" />
        </ul>
        <div className="border-border mt-3 space-y-1 border-t pt-3">
          <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
          <NavItem to="/debug" icon={Wrench} label="Parser debug" />
        </div>
      </nav>
      <div className="border-border text-sidebar-muted border-t p-3 text-xs">Pre-alpha</div>
    </aside>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  end,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground',
          )
        }
      >
        <Icon className="h-4 w-4" />
        {label}
      </NavLink>
    </li>
  );
}
