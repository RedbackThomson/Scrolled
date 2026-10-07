import type { KeyboardEvent, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { SlotTile } from './SlotTile';
import { cn } from '../../lib/cn';
import type { SlotTint } from '../../lib/interaction';

export interface EntityRowProps {
  /** `li` inside a list (the parent draws dividers), `div` inside a ListCard. */
  as?: 'div' | 'li';
  /** Replaces the slot tile, e.g. a lazily loaded sprite. */
  leading?: ReactNode;
  src?: string;
  icon?: LucideIcon;
  tint?: SlotTint;
  hue?: number;
  name: ReactNode;
  /** Shown after the name as " · subtitle", muted. */
  subtitle?: ReactNode;
  /** Right-aligned meta, e.g. "Lvl 45", "×3", "Etc"; stacks under the name on phones. */
  meta?: ReactNode;
  /** Sibling controls outside the main area, e.g. a "show on map" pin. */
  trailing?: ReactNode;
  selected?: boolean;
  /** Draws the top divider used inside a ListCard; off when the list draws its own. */
  divider?: boolean;
  /** First row in a ListCard (drops the divider) */
  first?: boolean;
  /** Hover tint and slide; on by default when the row does something. */
  interactive?: boolean;
  onClick?: () => void;
  /** Wraps the slot and text, e.g. in a link; receive the layout classes and the content. */
  renderMain?: (main: { className: string; children: ReactNode }) => ReactNode;
  className?: string;
}

const MAIN = 'flex min-w-0 flex-1 items-center gap-3';

export function EntityRow({
  as: Tag = 'div',
  leading,
  src,
  icon,
  tint,
  hue,
  name,
  subtitle,
  meta,
  trailing,
  selected,
  divider = true,
  first,
  interactive,
  onClick,
  renderMain,
  className,
}: EntityRowProps) {
  const hoverable = interactive ?? Boolean(onClick || renderMain);
  const content = (
    <>
      {leading ?? <SlotTile src={src} icon={icon} tint={tint} hue={hue} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {name}
          {subtitle && <span className="text-muted-foreground"> · {subtitle}</span>}
        </span>
        {/* Phones have no room for a right-aligned meta block. */}
        {meta != null && (
          <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] md:hidden">
            {meta}
          </span>
        )}
      </span>
    </>
  );
  return (
    <Tag
      onClick={onClick}
      {...(onClick && {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      })}
      className={cn(
        'ease-spring group flex min-h-[46px] items-center gap-3 px-3 py-[5px] text-[13.5px] transition-[background-color,padding] duration-300 max-md:min-h-[44px]',
        hoverable && 'hover:bg-muted hover:pl-4',
        selected && 'bg-muted',
        divider && !first && 'border-t-[1.5px] border-[var(--surface-sunken)]',
        onClick && 'sc-focus-ring cursor-pointer',
        className,
      )}
    >
      {renderMain ? (
        renderMain({ className: MAIN, children: content })
      ) : (
        <span className={MAIN}>{content}</span>
      )}
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {meta != null && (
        <span className="text-muted-foreground ml-auto hidden shrink-0 items-center gap-3 text-[11.5px] md:flex">
          {meta}
        </span>
      )}
    </Tag>
  );
}
