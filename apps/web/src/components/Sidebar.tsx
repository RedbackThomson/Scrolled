import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { getDbClient } from '@/db';
import { cn } from '@/lib/utils';

interface SidebarSection {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: { label: string; to: string }[];
  /** Which feature flag must be true for this entry to render. Always-visible
   *  entries (Home, Settings, Debug) omit this. */
  feature?: 'hasItems' | 'hasEquips' | 'hasMobs' | 'hasNpcs' | 'hasMaps' | 'hasQuests';
}

const ITEM_CATEGORY_CHILDREN = [
  { label: 'Use', to: '/items?category=use' },
  { label: 'Setup', to: '/items?category=setup' },
  { label: 'Etc', to: '/items?category=etc' },
  { label: 'Cash', to: '/items?category=cash' },
];

function titleCaseSlot(slot: string): string {
  // Slot keys come from String.wz/Eqp.img/Eqp child names lowercased.
  // "petequip" → "Pet Equip", "weapon" → "Weapon", "longcoat" → "Longcoat".
  const spaced = slot
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/(pet)(equip)/i, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function Sidebar() {
  const features = useFeatures();
  const db = useMemo(() => getDbClient(), []);
  const location = useLocation();

  const slotsQ = useQuery({
    queryKey: ['db', 'equip-slots'],
    queryFn: () => db.listEquipSlots(),
    enabled: features.hasEquips,
  });

  const equipChildren = useMemo(() => {
    if (!slotsQ.data || slotsQ.data.length === 0) return undefined;
    return slotsQ.data.map((s) => ({
      label: titleCaseSlot(s),
      to: `/equips?slot=${encodeURIComponent(s)}`,
    }));
  }, [slotsQ.data]);

  const allSections: SidebarSection[] = [
    {
      label: 'Items',
      to: '/items',
      icon: Package,
      feature: 'hasItems',
      children: ITEM_CATEGORY_CHILDREN,
    },
    {
      label: 'Equips',
      to: '/equips',
      icon: Shield,
      feature: 'hasEquips',
      children: equipChildren,
    },
    { label: 'Mobs', to: '/mobs', icon: Skull, feature: 'hasMobs' },
    { label: 'NPCs', to: '/npcs', icon: Users, feature: 'hasNpcs' },
    { label: 'Maps', to: '/maps', icon: MapIcon, feature: 'hasMaps' },
    { label: 'Quests', to: '/quests', icon: ScrollText, feature: 'hasQuests' },
  ];
  const entitySections = allSections.filter((s) => !s.feature || features[s.feature]);

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
          {entitySections.map((section) => {
            // Section's own link uses `end` so query-string children don't
            // also light up the parent — we drive parent active state
            // ourselves via pathname so it stays highlighted while a child
            // is selected.
            const sectionActive = location.pathname === section.to;
            return (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  end
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    sectionActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <section.icon className="h-4 w-4" />
                  {section.label}
                </NavLink>
                {section.children && section.children.length > 0 && (
                  <ul className="border-border ml-6 mt-1 space-y-0.5 border-l pl-3">
                    {section.children.map((child) => (
                      <SubNavItem key={child.to} to={child.to} label={child.label} />
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
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

/**
 * Subnav links carry a query string (`?slot=cap`), so `NavLink`'s default
 * pathname-only matching can't distinguish them. We compare the full
 * pathname+search against the current location instead.
 */
function SubNavItem({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;
  const active = current === to;
  return (
    <li>
      <NavLink
        to={to}
        className={cn(
          'block rounded px-2 py-1 text-xs transition-colors',
          active ? 'text-foreground font-medium' : 'text-sidebar-muted hover:text-foreground',
        )}
      >
        {label}
      </NavLink>
    </li>
  );
}
