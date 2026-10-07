import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { HoverPopover } from '@scrolled/design';
import { cn } from '@scrolled/design';

interface GraphicViewerIconProps {
  pixelX: number;
  pixelY: number;
  /** Outer CSS scale applied by the canvas — used to counter-scale the icon
   *  so it stays a constant CSS pixel size regardless of zoom. */
  parentScale: number;
  Icon: LucideIcon;
  colorClass: string;
  ariaLabel: string;
  tooltip: ReactNode;
  /** Primary highlight — the directly-selected/hovered entity. */
  highlighted?: boolean;
  /** Secondary highlight — entity connected to the highlighted one. */
  linked?: boolean;
  dimmed?: boolean;
  /** When set, the pin is clickable (e.g. world-map markers that navigate). */
  onClick?: () => void;
}

const ICON_PX = 26;
const SELECTED_PX = 32;

// The icon's *position* (left/top) is in image-pixel space so it scales with
// the graphic; the icon's *size* is a fixed CSS pixel count, achieved by
// applying `scale(1/parentScale)` so the parent's scale transform cancels out.
// End result: pin moves with the image, but the icon body stays legible at
// any zoom level.
export function GraphicViewerIcon({
  pixelX,
  pixelY,
  parentScale,
  Icon,
  colorClass,
  ariaLabel,
  tooltip,
  highlighted,
  linked,
  dimmed,
  onClick,
}: GraphicViewerIconProps) {
  const inv = 1 / parentScale;
  const size = highlighted ? SELECTED_PX : ICON_PX;
  // Half of the post-scale icon size, used to offset `left`/`top` so the
  // icon's visual centre lands exactly on (pixelX, pixelY).
  const halfPost = (size * inv) / 2;
  return (
    <HoverPopover
      content={tooltip}
      triggerClassName={cn(
        'pointer-events-auto absolute inline-flex items-center justify-center rounded-full transition-[opacity,width,height]',
        colorClass,
        highlighted ? 'z-20' : 'z-10',
        onClick && 'cursor-pointer',
        dimmed && 'opacity-40',
      )}
      triggerStyle={{
        left: pixelX - halfPost,
        top: pixelY - halfPost,
        width: size,
        height: size,
        transform: `scale(${inv})`,
        transformOrigin: 'top left',
        // `colorClass` sets currentColor; the disc fills with it and the glyph
        // is white, so any text-* class works as the marker colour.
        background: 'currentColor',
        boxShadow: highlighted
          ? '0 0 0 2.5px #fff, 0 3px 8px rgba(0,0,0,.3), 0 0 0 7px color-mix(in oklab, currentColor 35%, transparent)'
          : linked
            ? '0 0 0 2.5px #fff, 0 3px 8px rgba(0,0,0,.3), 0 0 0 6px color-mix(in oklab, currentColor 30%, transparent)'
            : '0 0 0 2.5px #fff, 0 3px 8px rgba(0,0,0,.3)',
      }}
      onTriggerClick={onClick}
      triggerProps={{
        'aria-label': ariaLabel,
        'data-highlighted': highlighted ? 'true' : undefined,
      }}
    >
      <Icon className="h-1/2 w-1/2 text-white" strokeWidth={2.5} aria-hidden />
    </HoverPopover>
  );
}
