import { useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Loader2,
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
import { useSidebarSections } from '@/lib/sidebarState';
import { getDbClient } from '@/db';
import { getUserDbClient } from '@/db/user';
import {
  resolveCollectionColor,
  resolveCollectionIcon,
} from '@/components/collections';
import { cn } from '@/lib/utils';

interface SidebarChild {
  label: string;
  to: string;
  /** Optional per-child icon (used by Collections children). */
  icon?: LucideIcon;
  /** Optional foreground color class for the icon. */
  iconClass?: string;
}

interface SidebarSection {
  label: string;
  to: string;
  icon: LucideIcon;
  children?: SidebarChild[];
  /** Which feature flag must be true for this entry to render. Always-visible
   *  entries (Home, Settings, Debug) omit this. */
  feature?: 'hasItems' | 'hasEquips' | 'hasMobs' | 'hasNpcs' | 'hasMaps' | 'hasQuests';
}

const ITEM_CATEGORY_CHILDREN = [
  { label: 'Use', to: '/items?f_category=use' },
  { label: 'Setup', to: '/items?f_category=setup' },
  { label: 'Etc', to: '/items?f_category=etc' },
  { label: 'Cash', to: '/items?f_category=cash' },
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
  const userDb = useMemo(() => getUserDbClient(), []);
  const location = useLocation();
  const expanded = useSidebarSections((s) => s.expanded);
  const toggleSection = useSidebarSections((s) => s.toggle);

  const slotsQ = useQuery({
    queryKey: ['db', 'equip-slots'],
    queryFn: () => db.listEquipSlots(),
    enabled: features.hasEquips,
  });

  const equipChildren = useMemo(() => {
    if (!slotsQ.data || slotsQ.data.length === 0) return undefined;
    return slotsQ.data.map((s) => ({
      label: titleCaseSlot(s),
      to: `/equips?f_slot=${encodeURIComponent(s)}`,
    }));
  }, [slotsQ.data]);

  const collectionsQ = useQuery({
    queryKey: ['user', 'collections', 'sidebar'],
    queryFn: () => userDb.listCollections(),
  });

  const collectionChildren = useMemo(() => {
    if (!collectionsQ.data || collectionsQ.data.length === 0) return undefined;
    return collectionsQ.data.map<SidebarChild>((c) => {
      const { Icon } = resolveCollectionIcon(c.icon);
      const color = resolveCollectionColor(c.color);
      return {
        label: c.name,
        to: `/collections/${c.id}`,
        icon: Icon,
        iconClass: color.iconColor,
      };
    });
  }, [collectionsQ.data]);

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
  const collectionsSection: SidebarSection = {
    label: 'Collections',
    to: '/collections',
    icon: Bookmark,
    children: collectionChildren,
  };
  const sectionsToRender = [...entitySections, collectionsSection];

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
          {sectionsToRender.map((section) => {
            // Section's own link uses `end` so query-string children don't
            // also light up the parent — we drive parent active state
            // ourselves via pathname so it stays highlighted while a child
            // is selected.
            const sectionActive = location.pathname === section.to;
            const hasChildren = !!section.children && section.children.length > 0;
            const isExpanded = !!expanded[section.to];
            const childListId = `sidebar-children-${section.to.replace(/[^a-z0-9]/gi, '-')}`;
            return (
              <li key={section.to}>
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-md transition-colors',
                    sectionActive
                      ? 'bg-accent text-accent-foreground'
                      : 'text-sidebar-muted hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  <NavLink
                    to={section.to}
                    end
                    className="flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium"
                  >
                    <section.icon className="h-4 w-4" />
                    {section.label}
                  </NavLink>
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.to)}
                      aria-expanded={isExpanded}
                      aria-controls={childListId}
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.label}`}
                      className="hover:bg-background/40 mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded"
                    >
                      <ChevronRight
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          isExpanded && 'rotate-90',
                        )}
                        aria-hidden
                      />
                    </button>
                  )}
                </div>
                {hasChildren && isExpanded && (
                  <ul
                    id={childListId}
                    className="border-border ml-6 mt-1 space-y-0.5 border-l pl-3"
                  >
                    {section.children!.map((child) => (
                      <SubNavItem
                        key={child.to}
                        to={child.to}
                        label={child.label}
                        icon={child.icon}
                        iconClass={child.iconClass}
                      />
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
      <DbStatusIndicator />
      <div className="text-sidebar-muted px-3 pb-3 text-[10px]">Pre-alpha</div>
    </aside>
  );
}

type DbHealth = 'pending' | 'healthy' | 'warning' | 'error';

const HEALTH_CONFIG: Record<
  DbHealth,
  {
    icon: LucideIcon;
    label: string;
    title: string;
    iconClass: string;
    textClass?: string;
    spin?: boolean;
  }
> = {
  pending: {
    icon: Loader2,
    label: 'Checking database…',
    title: 'Verifying database health',
    iconClass: 'text-sidebar-muted',
    spin: true,
  },
  healthy: {
    icon: CheckCircle2,
    label: 'Database OK',
    title: 'Database is healthy',
    iconClass: 'text-green-600 dark:text-green-400',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Re-import recommended',
    title: 'Database has problems — a re-import may be needed',
    iconClass: 'text-amber-600 dark:text-amber-400',
    textClass: 'text-amber-700 dark:text-amber-300',
  },
  error: {
    icon: AlertCircle,
    label: 'Database unavailable',
    title: 'Database is corrupted or unreachable — recreating from scratch may be required',
    iconClass: 'text-red-600 dark:text-red-400',
    textClass: 'text-red-700 dark:text-red-300',
  },
};

function DbStatusIndicator() {
  const db = useMemo(() => getDbClient(), []);
  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => db.status(),
  });

  // `warning` (needs re-import) and the corruption branch of `error` have no
  // detection wired up yet — for now we surface only the binary "status query
  // succeeded vs threw". Both UI states are kept defined so the future signals
  // have a place to land.
  let health: DbHealth;
  if (statusQ.isPending) health = 'pending';
  else if (statusQ.isError) health = 'error';
  else health = 'healthy';

  const cfg = HEALTH_CONFIG[health];
  const Icon = cfg.icon;

  return (
    <div
      className="border-border border-t px-3 pb-2 pt-3"
      title={cfg.title}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-xs">
        <Icon
          className={cn('h-3.5 w-3.5 shrink-0', cfg.iconClass, cfg.spin && 'animate-spin')}
          aria-hidden
        />
        <span className={cn('truncate', cfg.textClass ?? 'text-sidebar-foreground')}>
          {cfg.label}
        </span>
      </div>
    </div>
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
 * Subnav links carry a query string (`?f_slot=cap`), so `NavLink`'s default
 * pathname-only matching can't distinguish them. We compare the full
 * pathname+search against the current location instead.
 */
function SubNavItem({
  to,
  label,
  icon: Icon,
  iconClass,
}: {
  to: string;
  label: string;
  icon?: LucideIcon;
  iconClass?: string;
}) {
  const location = useLocation();
  const current = `${location.pathname}${location.search}`;
  const active = current === to;
  return (
    <li>
      <NavLink
        to={to}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
          active ? 'text-foreground font-medium' : 'text-sidebar-muted hover:text-foreground',
        )}
      >
        {Icon && <Icon className={cn('h-3 w-3 shrink-0', iconClass)} aria-hidden />}
        <span className="truncate">{label}</span>
      </NavLink>
    </li>
  );
}
