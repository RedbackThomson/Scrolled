import { cn } from '@scrolled/design';
import type { LayerDescriptor, LayerVisibility } from './types';

interface GraphicViewerLayerControlsProps {
  layers: LayerDescriptor[];
  value: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
}

export function GraphicViewerLayerControls({
  layers,
  value,
  onChange,
}: GraphicViewerLayerControlsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {layers.map(({ key, label, Icon, swatch, count }) => {
        const on = value[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...value, [key]: !on })}
            aria-pressed={on}
            className={cn(
              'bg-card text-foreground shadow-float ease-spring focus-visible:ring-primary/30 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12.5px] font-bold transition-[transform,opacity] duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4',
              !on && 'opacity-50',
            )}
          >
            <span
              className={cn(
                'grid h-5 w-5 place-items-center rounded-full',
                on ? swatch : 'text-border',
              )}
              style={{ background: 'currentColor' }}
            >
              <Icon className="h-3 w-3 text-white" strokeWidth={2.5} aria-hidden />
            </span>
            {label}
            <span className="text-muted-foreground font-semibold">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
