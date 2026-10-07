import { useMemo, useRef } from 'react';
import { Link, NavLink, useLocation, useMatch } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  Compass,
  ExternalLink,
  GitBranch,
  Loader2,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Users,
  Map as MapIcon,
  ScrollText,
  Home,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { WEAPON_TYPE_ORDER, labelForEquipSlot, labelForEquipType } from '@scrolled/game-db/domain/equipTypes';
import { useFeatures } from '@/hooks/useFeatures';
import { useDataState } from '@/hooks/useDataState';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSidebarLayout, useSidebarSections } from '@/stores/sidebarState';
import { getDbClient } from '@/db';
import { getUserDbClient } from '@/db/user';
import { resolveCollectionColor } from '@/components/collections/colorRegistry';
import { resolveCollectionIcon } from '@/components/collections/iconRegistry';
import { DatasetVersionTag } from '@/components/dataset/DatasetVersionTag';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';
import { SidebarSyncStatus } from '@/components/sync/SidebarSyncStatus';
import { SyncSignInNotice } from '@/components/sync/SyncSignInNotice';
import { useInstalledDataset } from '@/hooks/dataset/useInstalledDataset';
import { cn, Logo, NavItem, StatusDot } from '@scrolled/design';
import { appConfig } from '@/config';
import { SlidingNavPill } from '@/components/layout/SlidingNavPill';
import { getSettingsGroups } from '@/components/settings/settingsGroups';

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
  feature?:
    | 'hasItems'
    | 'hasEquips'
    | 'hasMobs'
    | 'hasNpcs'
    | 'hasMaps'
    | 'hasQuests'
    | 'hasQuestChains'
    | 'hasSkills';
}

const ITEM_CATEGORY_CHILDREN = [
  { label: 'Use', to: '/items?f_category=use' },
  { label: 'Setup', to: '/items?f_category=setup' },
  { label: 'Etc', to: '/items?f_category=etc' },
  { label: 'Cash', to: '/items?f_category=cash' },
];

export interface SidebarProps {
  /**
   * `mobile`: the sidebar is rendered inside the mobile slide-in drawer
   * (always visible, full content, parent owns the open/close).
   */
  variant?: 'desktop' | 'mobile';
}

export function Sidebar({ variant = 'desktop' }: SidebarProps = {}) {
  const features = useFeatures();
  const hostedName = useInstalledDataset()?.displayName ?? null;
  const db = useMemo(() => getDbClient(), []);
  const userDb = useMemo(() => getUserDbClient(), []);
  const location = useLocation();
  const navRowsRef = useRef<HTMLDivElement>(null);
  const expanded = useSidebarSections((s) => s.expanded);
  const toggleSection = useSidebarSections((s) => s.toggle);
  const collapsedDesktop = useSidebarLayout((s) => s.collapsed);
  const toggleCollapsed = useSidebarLayout((s) => s.toggleCollapsed);
  // Mobile drawer always renders the full sidebar — collapsed state only
  // applies to the desktop rail.
  const collapsed = variant === 'desktop' && collapsedDesktop;
  // Only the desktop variant gets the collapse toggle — mobile uses the
  // drawer's own close button, and collapsing makes no sense there.
  const showCollapseToggle = variant === 'desktop';

  const slotsQ = useQuery({
    queryKey: ['db', 'equip-slots'],
    queryFn: () => db.listEquipSlots(),
    enabled: features.hasEquips,
  });

  // Weapons get their own top-level section now, so the Equips slot nav
  // hides the `weapon` slot — its rows aren't on /equips anymore.
  const equipChildren = useMemo(() => {
    if (!slotsQ.data || slotsQ.data.length === 0) return undefined;
    return slotsQ.data
      .filter((s) => s !== 'weapon')
      .map((s) => ({
        label: labelForEquipSlot(s),
        to: `/equips?f_slot=${encodeURIComponent(s)}`,
      }));
  }, [slotsQ.data]);

  const equipTypesQ = useQuery({
    queryKey: ['db', 'equip-types'],
    queryFn: () => db.listEquipTypes(),
    enabled: features.hasEquips,
  });

  // Order the sidebar entries by the canonical weapon-type list (so the
  // nav reads sword → axe → ... rather than alphabetical). Filter to
  // values actually present so we don't surface empty subpages.
  const weaponChildren = useMemo(() => {
    const present = new Set(equipTypesQ.data ?? []);
    if (present.size === 0) return undefined;
    return WEAPON_TYPE_ORDER.filter((t) => present.has(t)).map((t) => ({
      label: labelForEquipType(t),
      to: `/weapons?f_equipType=${encodeURIComponent(t)}`,
    }));
  }, [equipTypesQ.data]);
  const hasWeapons = (equipTypesQ.data?.length ?? 0) > 0;

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

  // Chains hang off the Quests section as a sibling listing (similar to how
  // weapon-type subitems hang off Equips). Only surfaced once the chain
  // pass has populated the cache; if quests are present but no chains were
  // derived, the parent listing still works without a stray subitem.
  const questChildren = useMemo<SidebarChild[] | undefined>(() => {
    if (!features.hasQuestChains) return undefined;
    return [{ label: 'Chains', to: '/quest-chains', icon: GitBranch }];
  }, [features.hasQuestChains]);

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
    ...(hasWeapons
      ? ([
          {
            label: 'Weapons',
            to: '/weapons',
            icon: Swords,
            feature: 'hasEquips',
            children: weaponChildren,
          },
        ] as const)
      : []),
    { label: 'Mobs', to: '/mobs', icon: Skull, feature: 'hasMobs' },
    { label: 'NPCs', to: '/npcs', icon: Users, feature: 'hasNpcs' },
    { label: 'Maps', to: '/maps', icon: MapIcon, feature: 'hasMaps' },
    {
      label: 'Quests',
      to: '/quests',
      icon: ScrollText,
      feature: 'hasQuests',
      children: questChildren,
    },
    { label: 'Skills', to: '/skills', icon: Sparkles, feature: 'hasSkills' },
  ];
  const entitySections = allSections.filter((s) => !s.feature || features[s.feature]);
  const collectionsSection: SidebarSection = {
    label: 'Collections',
    to: '/collections',
    icon: Bookmark,
    children: collectionChildren,
  };
  const sectionsToRender = [...entitySections, collectionsSection];

  // Desktop visibility is controlled here; mobile variant is rendered inside
  // a Dialog that handles its own visibility, so it must always be visible
  // and take its parent's width.
  const rootClass =
    variant === 'mobile'
      ? 'text-sidebar-foreground flex h-full w-full flex-col gap-3.5 px-3 py-4'
      : cn(
          // Sticky + h-screen + self-start keeps the sidebar pinned in the viewport
          // while the document scrolls underneath it. The outer AppShell flex row
          // would otherwise stretch the aside to the full page height, defeating
          // sticky positioning.
          'text-sidebar-foreground hidden shrink-0 self-start py-4 transition-[width] duration-200 ease-out md:sticky md:top-0 md:flex md:h-screen md:flex-col md:gap-3.5',
          collapsed ? 'w-16 px-2' : 'w-[228px] px-3',
        );

  return (
    <aside className={rootClass}>
      <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-2 px-2 py-0.5')}>
        {!collapsed && (
          <div className="min-w-0" title={hostedName ?? undefined}>
            <Logo size={34} subtitle={hostedName ?? undefined} />
          </div>
        )}
        {showCollapseToggle && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-float inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              !collapsed && 'ml-auto',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </div>
      <nav className="-mx-1 flex-1 overflow-y-auto px-1 py-1">
        <div ref={navRowsRef} className="relative">
          <SlidingNavPill
            containerRef={navRowsRef}
            watch={[location.pathname, location.search, collapsed]}
          />
          <ul className="relative space-y-0.5">
            <RouteNavItem to="/" icon={Home} label="Home" end collapsed={collapsed} />
            {sectionsToRender.map((section) => {
              // Section's own link uses `end` so query-string children don't
              // also light up the parent — we drive parent active state
              // ourselves via pathname so it stays highlighted while a child
              // is selected.
              const sectionActive = location.pathname === section.to;
              const hasChildren = !!section.children && section.children.length > 0;
              const isExpanded = !collapsed && !!expanded[section.to];
              const childListId = `sidebar-children-${section.to.replace(/[^a-z0-9]/gi, '-')}`;
              return (
                <li key={section.to}>
                  <NavItem
                    icon={section.icon}
                    label={section.label}
                    active={sectionActive}
                    collapsed={collapsed}
                    indicator="none"
                    onToggle={hasChildren ? () => toggleSection(section.to) : undefined}
                    expanded={isExpanded}
                    controls={childListId}
                    renderLink={(props) => <NavLink to={section.to} end {...props} />}
                  />
                  {hasChildren && isExpanded && (
                    <ul
                      id={childListId}
                      className="border-border my-0.5 ml-[26px] space-y-px border-l-2 pl-3"
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
            <li role="separator" aria-hidden className="h-3" />
            {appConfig.navigatorUrl && (
              <ExternalNavItem
                href={appConfig.navigatorUrl}
                icon={Compass}
                label="Navigator"
                collapsed={collapsed}
              />
            )}
            <RouteNavItem to="/settings" icon={SettingsIcon} label="Settings" collapsed={collapsed} />
            {!collapsed && location.pathname.startsWith('/settings') && (
              <li>
                <ul className="border-border my-0.5 ml-[26px] space-y-px border-l-2 pl-3">
                  {getSettingsGroups().map((g) => (
                    <SubNavItem key={g.id} to={`/settings/${g.id}`} label={g.label} icon={g.icon} />
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      </nav>
      <div className={cn('bg-card shadow-float py-1', collapsed ? 'rounded-full' : 'rounded-[18px]')}>
        <OfflineIndicator collapsed={collapsed} />
        <SyncSignInNotice collapsed={collapsed} />
        <SidebarSyncStatus collapsed={collapsed} />
        <DbStatusIndicator collapsed={collapsed} trailing={APP_VERSION_LABEL} />
        <DatasetVersionTag collapsed={collapsed} />
      </div>
    </aside>
  );
}

// `VITE_APP_VERSION` is injected by the GitHub Pages deploy workflow on tag
// pushes (`v1.2.3`). Untagged builds fall back to the pre-release marker, with
// the short commit hash (`VITE_APP_COMMIT`) appended when the deploy workflow
// stamps it. Local dev has neither and shows the bare marker.
const APP_VERSION_TAG = import.meta.env.VITE_APP_VERSION as string | undefined;
const APP_VERSION_COMMIT = import.meta.env.VITE_APP_COMMIT as string | undefined;
const APP_VERSION_LABEL =
  APP_VERSION_TAG || (APP_VERSION_COMMIT ? `Pre-alpha · ${APP_VERSION_COMMIT}` : 'Pre-alpha');

type DbHealth =
  | 'pending'
  | 'healthy'
  | 'warning'
  | 'error'
  | 'reinitialize'
  | 'update'
  | 'updating'
  | 'update-failed';

interface HealthCfg {
  /** Dot colour; omitted while work is in flight, which shows a spinner instead. */
  dot?: 'ok' | 'warn' | 'danger';
  label: string;
  title: string;
  /** When set, the indicator links here so the user can act on the state. */
  actionTo?: string;
}

const HEALTH_CONFIG: Record<DbHealth, HealthCfg> = {
  pending: {
    label: 'Checking database…',
    title: 'Verifying database health',
  },
  healthy: {
    dot: 'ok',
    label: 'Database OK',
    title: 'Database is healthy and persisted to OPFS',
  },
  warning: {
    dot: 'warn',
    label: 'In-memory only',
    title:
      'Persistent storage (OPFS) is unavailable, so the database lives only in memory. Reloading the page will wipe it and require re-importing.',
  },
  error: {
    dot: 'danger',
    label: 'Database unavailable',
    title: 'Database is corrupted or unreachable — recreating from scratch may be required',
  },
  reinitialize: {
    dot: 'danger',
    label: 'Rebuild needed',
    title: 'This version changed how your library is stored. Reload your game files to rebuild it.',
    actionTo: '/setup',
  },
  update: {
    dot: 'warn',
    label: 'Refresh library',
    title:
      'Your library is out of date. Re-run setup with your game files to unlock the latest features.',
    actionTo: '/setup',
  },
  updating: {
    label: 'Updating data…',
    title: 'Downloading and installing the latest data for this version.',
  },
  'update-failed': {
    dot: 'warn',
    label: 'Update failed',
    title: "Couldn't download the latest data. Click to try again.",
  },
};

const OFFLINE_TOOLTIP =
  'Everything still works while offline. The app will check for new versions once you reconnect.';

function OfflineIndicator({ collapsed }: { collapsed: boolean }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      className={collapsed ? 'flex justify-center py-2' : 'px-3.5 py-1.5'}
      title={OFFLINE_TOOLTIP}
      role="status"
      aria-live="polite"
    >
      <StatusDot status="offline" label={collapsed ? undefined : 'Offline mode'} />
      {collapsed && <span className="sr-only">Offline mode</span>}
    </div>
  );
}

function DbStatusIndicator({
  collapsed,
  trailing,
}: {
  collapsed: boolean;
  /** Small text at the far end of the row, hidden in the collapsed rail. */
  trailing?: string;
}) {
  const db = useMemo(() => getDbClient(), []);
  const userDb = useMemo(() => getUserDbClient(), []);
  // Both DBs share the same OPFS-or-bust definition of "healthy" — if either
  // is on the in-memory fallback the user loses that DB's contents on
  // reload, so we surface a warning regardless of which side it is.
  const gameStatusQ = useQuery({ queryKey: ['db', 'status'], queryFn: () => db.status() });
  const userStatusQ = useQuery({ queryKey: ['user', 'status'], queryFn: () => userDb.status() });
  const { state: dataState } = useDataState();
  // Fixed-deployment dataset refresh (auto-applied or manual). Display-only here;
  // the auto-apply itself fires from DatasetAutoUpdate.
  const dataset = useDatasetUpdate();

  let health: DbHealth;
  let reason: string | null = null;
  if (gameStatusQ.isPending || userStatusQ.isPending) {
    health = 'pending';
  } else if (gameStatusQ.isError || userStatusQ.isError) {
    health = 'error';
  } else if (dataset.applying) {
    // A dataset download/import is in flight — outrank the staleness states it's
    // resolving, but not a broken on-device store above.
    health = 'updating';
  } else if (dataset.error && dataset.mode !== 'none') {
    health = 'update-failed';
  } else if (dataState === 'reinitialize-required') {
    // A library too old to read outranks the in-memory warning — rebuilding is
    // the only way forward and that flow starts at /setup anyway.
    health = 'reinitialize';
  } else {
    const inMemory: string[] = [];
    if (gameStatusQ.data.backend !== 'opfs') {
      inMemory.push(`Game DB: ${gameStatusQ.data.fallbackReason ?? 'OPFS unavailable.'}`);
    }
    if (userStatusQ.data.backend !== 'opfs') {
      inMemory.push(`User DB: ${userStatusQ.data.fallbackReason ?? 'OPFS unavailable.'}`);
    }
    if (inMemory.length > 0) {
      health = 'warning';
      reason = inMemory.join('\n');
    } else if (dataState === 'update-recommended') {
      health = 'update';
    } else {
      health = 'healthy';
    }
  }

  // Fixed-dataset deployments have no setup wizard. The soft "refresh via setup"
  // nudge doesn't apply, and a too-old library is resolved by installing a newer
  // dataset (or updating the app), never by re-running setup.
  const canImport = appConfig.features.enableUserImport;
  if (!canImport && health === 'update') health = 'healthy';

  let cfg = HEALTH_CONFIG[health];
  if (!canImport && health === 'reinitialize') {
    cfg = {
      ...cfg,
      label: 'Update required',
      title:
        'This dataset is incompatible with the current app version. A newer dataset or app update is needed.',
      actionTo: undefined,
    };
  }
  const title = [
    cfg.title,
    reason,
    dataset.installedVersion && `Data version ${dataset.installedVersion}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  const label = collapsed ? undefined : cfg.label;

  const body = (
    <div className="flex items-center gap-2">
      {cfg.dot ? (
        <StatusDot status={cfg.dot} label={label} />
      ) : (
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
          <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          {label}
        </span>
      )}
      {collapsed ? (
        <span className="sr-only">{cfg.label}</span>
      ) : (
        trailing && (
          <span className="text-muted-foreground ml-auto truncate text-[10.5px]">{trailing}</span>
        )
      )}
    </div>
  );

  const containerClass = collapsed ? 'flex justify-center py-2' : 'px-3.5 py-1.5';

  // A failed refresh retries in place rather than navigating.
  const onAction = health === 'update-failed' ? dataset.apply : undefined;
  if (onAction) {
    return (
      <button
        type="button"
        onClick={onAction}
        className={cn(containerClass, 'hover:bg-muted block w-full rounded-[14px] text-left transition-colors')}
        title={title}
      >
        {body}
      </button>
    );
  }

  if (cfg.actionTo) {
    return (
      <Link
        to={cfg.actionTo}
        className={cn(containerClass, 'hover:bg-muted block rounded-[14px] transition-colors')}
        title={title}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={containerClass} title={title} role="status" aria-live="polite">
      {body}
    </div>
  );
}

function RouteNavItem({
  to,
  icon,
  label,
  end,
  collapsed,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  collapsed?: boolean;
}) {
  const active = useMatch({ path: to, end: !!end }) !== null;
  return (
    <li>
      <NavItem
        icon={icon}
        label={label}
        active={active}
        collapsed={collapsed}
        indicator="none"
        renderLink={(props) => <NavLink to={to} end={end} {...props} />}
      />
    </li>
  );
}

/**
 * A sibling-app link that leaves the wiki SPA entirely (Navigator lives at its
 * own subpath / origin — client-side routing would land on the wiki NotFound
 * route), so it needs a real `<a href>` for a full navigation.
 */
function ExternalNavItem({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
}) {
  return (
    <li>
      <NavItem
        icon={icon}
        label={label}
        collapsed={collapsed}
        trailing={<ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />}
        renderLink={(props) => <a href={href} target="_blank" rel="noreferrer" {...props} />}
      />
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
  icon,
  iconClass,
}: {
  to: string;
  label: string;
  icon?: LucideIcon;
  iconClass?: string;
}) {
  const location = useLocation();
  const active = `${location.pathname}${location.search}` === to;
  return (
    <li>
      <NavItem
        size="sm"
        icon={icon}
        iconClassName={iconClass}
        label={label}
        active={active}
        indicator="none"
        renderLink={(props) => <NavLink to={to} {...props} />}
      />
    </li>
  );
}
