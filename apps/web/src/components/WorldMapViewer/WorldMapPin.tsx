import type { ReactNode } from 'react';
import { HoverPopover, cn } from '@scrolled/design';

interface Props {
  pixelX: number;
  pixelY: number;
  /** Canvas zoom; the pin counter-scales so it stays a constant CSS size. */
  parentScale: number;
  hue: number;
  /** Regions draw larger than single-map markers. */
  region: boolean;
  label: string;
  /** Show the pill label (the active or "you are here" marker). */
  labelled: boolean;
  highlighted: boolean;
  dimmed: boolean;
  tooltip: ReactNode;
  onClick: () => void;
}

const HIT_PX = 24;

export function WorldMapPin({
  pixelX,
  pixelY,
  parentScale,
  hue,
  region,
  label,
  labelled,
  highlighted,
  dimmed,
  tooltip,
  onClick,
}: Props) {
  const inv = 1 / parentScale;
  const dot = highlighted ? 22 : region ? 18 : 16;
  const color = `oklch(0.68 0.15 ${hue})`;
  return (
    <HoverPopover
      content={tooltip}
      triggerClassName={cn(
        'pointer-events-auto absolute z-10 cursor-pointer transition-opacity duration-200',
        dimmed && 'opacity-40',
        highlighted && 'z-20',
      )}
      triggerStyle={{
        left: pixelX - (HIT_PX * inv) / 2,
        top: pixelY - (HIT_PX * inv) / 2,
        width: HIT_PX,
        height: HIT_PX,
        transform: `scale(${inv})`,
        transformOrigin: 'top left',
      }}
      onTriggerClick={onClick}
      triggerProps={{
        'aria-label': label,
        'data-highlighted': highlighted ? 'true' : undefined,
      }}
    >
      <span className="absolute inset-0 grid place-items-center">
        <span
          className="ease-spring block rounded-full transition-[width,height,box-shadow] duration-300"
          style={{
            width: dot,
            height: dot,
            background: color,
            boxShadow: highlighted
              ? `0 0 0 3px #fff, 0 3px 8px rgba(0,0,0,.25), 0 0 0 9px oklch(0.68 0.15 ${hue} / .3)`
              : '0 0 0 3px #fff, 0 3px 8px rgba(0,0,0,.25)',
          }}
        />
      </span>
      {labelled && (
        <span
          aria-hidden
          className="bg-card text-foreground shadow-float font-display pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
        >
          {label}
        </span>
      )}
    </HoverPopover>
  );
}
