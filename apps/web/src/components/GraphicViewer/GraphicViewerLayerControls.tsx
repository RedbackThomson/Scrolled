import { cn } from '@scrolled/ui';
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
    <div className="border-border bg-muted/30 flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-2">
      {layers.map(({ key, label, Icon, swatch, count }) => {
        const on = value[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...value, [key]: !on })}
            aria-pressed={on}
            className={cn(
              'border-border inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
              on ? 'bg-card text-foreground' : 'text-muted-foreground bg-transparent opacity-60',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', swatch)} strokeWidth={2.5} />
            <span>{label}</span>
            <span className="text-muted-foreground font-mono text-[10px]">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
