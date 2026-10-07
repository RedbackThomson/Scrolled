import type { ReactNode } from 'react';
import { BookmarkPlus, type LucideIcon } from 'lucide-react';
import { Icon } from '../core/Icon';
import { cn } from '../../lib/cn';

/** The hover card's dark surface, for states with no entity to show (loading, not found). */
export function HoverCardSurface({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-surface="tooltip"
      className={cn(
        'bg-card text-card-foreground w-[300px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[18px] shadow-[0_0_0_1px_var(--tooltip-line),var(--shadow-tooltip)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface HoverCardProps {
  /** Sprite URL for the tile. */
  src?: string;
  /** Glyph for the tile when there's no sprite. */
  icon?: LucideIcon;
  /** Tile content that isn't a plain image or glyph, e.g. a lazily loaded sprite. */
  media?: ReactNode;
  /** Tile size in px; 64 for sprites, smaller for glyph tiles. */
  mediaSize?: number;
  /** Tints the tile with an entity hue, for glyph tiles. */
  mediaHue?: number;
  title: ReactNode;
  badge?: ReactNode;
  /** Lines beside the tile, under the title. */
  children?: ReactNode;
  /** Full-width blocks under the header, e.g. stat tiles or a description. */
  below?: ReactNode;
  /** Replaces the default "Save to collection" footer. */
  footer?: ReactNode;
  /** null hides the default footer */
  onSave?: (() => void) | null;
}

export function HoverCard({
  src,
  icon,
  media,
  mediaSize = 64,
  mediaHue,
  title,
  badge,
  children,
  below,
  footer,
  onSave,
}: HoverCardProps) {
  return (
    <HoverCardSurface>
      <div className="flex gap-3 p-3">
        <div
          className="grid shrink-0 place-items-center self-start overflow-hidden rounded-[14px] shadow-[inset_0_1px_0_rgba(255,255,255,.08),inset_0_-2px_0_rgba(0,0,0,.06)] [&_img]:max-h-[56px] [&_img]:max-w-[56px]"
          style={{
            width: mediaSize,
            height: mediaSize,
            background:
              mediaHue === undefined
                ? 'var(--surface-tooltip-tile)'
                : `oklch(0.5 0.08 ${mediaHue} / .5)`,
            color: mediaHue === undefined ? undefined : `oklch(0.85 0.1 ${mediaHue})`,
          }}
        >
          {media ??
            (src ? (
              <img src={src} alt="" className="h-[54px] w-[54px] object-contain" />
            ) : (
              icon && <Icon icon={icon} size={26} />
            ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <div className="font-display min-w-0 text-[17px] font-semibold leading-tight">
              {title}
            </div>
            {badge}
          </div>
          {children}
        </div>
      </div>
      {below && <div className="space-y-2 px-3 pb-2.5 text-xs">{below}</div>}
      {footer ??
        (onSave !== null && (
          <div className="border-t border-[var(--tooltip-line)] p-1.5">
            <button
              type="button"
              onClick={onSave}
              className="sc-focus-ring text-muted-foreground hover:text-foreground hover:bg-muted flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors"
            >
              <Icon icon={BookmarkPlus} size={14} />
              Save to collection
            </button>
          </div>
        ))}
    </HoverCardSurface>
  );
}
