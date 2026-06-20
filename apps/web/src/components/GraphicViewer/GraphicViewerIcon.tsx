import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { HoverPopover } from '@/components/common/HoverPopover';
import { cn } from '@/lib/utils';

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

const ICON_PX = 22;

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
  // Half of the post-scale icon size, used to offset `left`/`top` so the
  // icon's visual centre lands exactly on (pixelX, pixelY).
  const halfPost = (ICON_PX * inv) / 2;
  return (
    <HoverPopover
      content={tooltip}
      triggerClassName={cn(
        'pointer-events-auto absolute z-10 inline-flex items-center justify-center rounded-full transition-opacity',
        colorClass,
        onClick && 'cursor-pointer',
        dimmed && 'opacity-25',
      )}
      triggerStyle={{
        left: pixelX - halfPost,
        top: pixelY - halfPost,
        width: ICON_PX,
        height: ICON_PX,
        transform: `scale(${inv})`,
        transformOrigin: 'top left',
        // White disc with a dark hairline so the colored glyph reads against
        // any background. Highlight upgrades the ring to emerald.
        background: 'white',
        boxShadow: highlighted
          ? '0 0 0 2.5px rgb(16 185 129), 0 1px 4px rgba(0,0,0,0.45)'
          : linked
            ? '0 0 0 2px rgb(139 92 246), 0 1px 3px rgba(0,0,0,0.4)'
            : '0 0 0 1px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.35)',
      }}
      onTriggerClick={onClick}
      triggerProps={{
        'aria-label': ariaLabel,
        'data-highlighted': highlighted ? 'true' : undefined,
      }}
    >
      <Icon className="h-full w-full p-[4px]" strokeWidth={2.5} />
    </HoverPopover>
  );
}
