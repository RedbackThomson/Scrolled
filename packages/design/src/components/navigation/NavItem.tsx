import type { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

/** Props a `renderLink` element spreads onto itself. */
export interface NavItemLinkProps {
  className: string;
  children: ReactNode;
  title?: string;
  'aria-label'?: string;
  'data-nav-active'?: true;
}

export interface NavItemProps {
  icon?: LucideIcon;
  /** Colours the icon, e.g. a collection's colour. */
  iconClassName?: string;
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
  /** Icon-only row for the collapsed rail; the label moves to the tooltip. */
  collapsed?: boolean;
  /** Content after the label, e.g. an external-link glyph. */
  trailing?: ReactNode;
  /** `none` leaves the active fill to a shared indicator that slides between rows. */
  indicator?: 'pill' | 'none';
  /** Shows the expand chevron for a row with children. */
  onToggle?: () => void;
  expanded?: boolean;
  /** Id of the child list the chevron controls. */
  controls?: string;
  /** Renders the row as a router or external link; defaults to a button. */
  renderLink?: (props: NavItemLinkProps) => ReactNode;
  onClick?: () => void;
}

const PILL =
  'ease-spring rounded-full font-semibold transition-[transform,color,background-color,box-shadow] duration-300';
const IDLE = 'text-muted-foreground hover:text-foreground hover:scale-[1.04]';

export function NavItem({
  icon: Icon,
  iconClassName,
  label,
  active,
  size = 'md',
  collapsed,
  trailing,
  indicator = 'pill',
  onToggle,
  expanded,
  controls,
  renderLink,
  onClick,
}: NavItemProps) {
  const sm = size === 'sm';
  const state = active
    ? cn('text-foreground', indicator === 'pill' && 'bg-card shadow-float')
    : IDLE;
  const navActive = active ? (true as const) : undefined;
  const content = (
    <>
      {Icon && (
        <Icon
          className={cn('shrink-0', sm ? 'h-3.5 w-3.5' : 'h-4 w-4', iconClassName)}
          aria-hidden
        />
      )}
      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}
      {!collapsed && trailing}
    </>
  );
  const link = (props: NavItemLinkProps) =>
    renderLink ? (
      renderLink(props)
    ) : (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        {...props}
        className={cn(props.className, !collapsed && 'w-full text-left')}
      />
    );

  if (onToggle && !collapsed) {
    return (
      <div data-nav-active={navActive} className={cn(PILL, 'flex items-center gap-1', state)}>
        {link({
          className: cn(
            'sc-focus-ring flex flex-1 items-center rounded-full max-md:min-h-11',
            sm ? 'min-h-[30px] gap-2 pl-2.5 text-[13px]' : 'min-h-9 gap-2.5 pl-3.5 text-sm',
          ),
          children: content,
        })}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={controls}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
          className="sc-focus-ring hover:bg-muted mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full max-md:mr-0 max-md:h-11 max-md:w-11"
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 opacity-[.55] transition-transform',
              expanded && 'rotate-90',
            )}
            aria-hidden
          />
        </button>
      </div>
    );
  }

  return link({
    'data-nav-active': navActive,
    title: collapsed ? label : undefined,
    'aria-label': collapsed ? label : undefined,
    className: cn(
      PILL,
      'sc-focus-ring flex items-center',
      collapsed
        ? 'mx-auto h-9 w-9 justify-center'
        : sm
          ? 'min-h-[30px] gap-2 px-2.5 text-[13px] max-md:min-h-11'
          : 'min-h-9 gap-2.5 px-3.5 text-sm max-md:min-h-11',
      state,
    ),
    children: content,
  });
}
