import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSettingsScrollSpy } from '@/components/settings/SettingsScrollSpy';
import {
  getSettingsNavItems,
  type SettingsSectionNavItem,
} from '@/components/settings/settingsNavConfig';
import { cn } from '@/lib/utils';

interface SettingsNavListProps {
  onNavigate?: () => void;
  className?: string;
}

export function useSettingsNavState() {
  const location = useLocation();
  const items = useMemo(() => getSettingsNavItems(), []);
  const { active } = useSettingsScrollSpy();
  const onDeveloperPage = location.pathname === '/settings/developer';

  return { items, activeSectionId: onDeveloperPage ? null : active, onDeveloperPage };
}

function NavItem({
  item,
  active,
  onNavigate,
}: {
  item: SettingsSectionNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { link, scrollTo } = useSettingsScrollSpy();

  const onSectionClick = useCallback(
    (id: string) => {
      onNavigate?.();
      if (location.pathname === '/settings') {
        scrollTo(id);
        window.history.replaceState(null, '', `#${id}`);
      } else {
        navigate(`/settings#${id}`);
      }
    },
    [location.pathname, navigate, onNavigate, scrollTo],
  );

  if (item.kind === 'route') {
    return (
      <Link
        to={item.to}
        onClick={onNavigate}
        className={cn(
          'block rounded-md px-2 py-1.5 text-sm transition-colors',
          active
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        {item.label}
      </Link>
    );
  }

  if (location.pathname === '/settings') {
    const linkProps = link(item.id);
    return (
      <button
        type="button"
        {...linkProps}
        onClick={() => {
          linkProps.onClick?.();
          onNavigate?.();
        }}
        className={cn(
          'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
          active
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        {item.label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSectionClick(item.id)}
      className={cn(
        'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {item.label}
    </button>
  );
}

export function SettingsNavList({ onNavigate, className }: SettingsNavListProps) {
  const { items, activeSectionId, onDeveloperPage } = useSettingsNavState();

  return (
    <nav aria-label="Settings sections" className={className}>
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active =
            item.kind === 'route'
              ? onDeveloperPage
              : !onDeveloperPage && item.id === activeSectionId;
          return (
            <li key={item.kind === 'route' ? item.to : item.id}>
              <NavItem item={item} active={active} onNavigate={onNavigate} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsSectionNav() {
  return (
    <aside className="hidden w-44 shrink-0 md:block">
      <div className="sticky top-20">
        <SettingsNavList />
      </div>
    </aside>
  );
}
