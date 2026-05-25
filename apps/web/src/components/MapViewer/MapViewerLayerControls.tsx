import { DoorOpen, Repeat, Skull, Sparkles, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LayerKey, LayerVisibility } from './types';

interface MapViewerLayerControlsProps {
  value: LayerVisibility;
  onChange: (next: LayerVisibility) => void;
  counts: Record<LayerKey, number>;
}

const LAYERS: Array<{
  key: LayerKey;
  label: string;
  Icon: LucideIcon;
  swatch: string;
}> = [
  { key: 'spawns', label: 'Spawns', Icon: Sparkles, swatch: 'text-emerald-500' },
  { key: 'portals', label: 'Portals', Icon: DoorOpen, swatch: 'text-sky-500' },
  { key: 'teleports', label: 'Teleports', Icon: Repeat, swatch: 'text-violet-500' },
  { key: 'npcs', label: 'NPCs', Icon: Users, swatch: 'text-amber-500' },
  { key: 'mobs', label: 'Mobs', Icon: Skull, swatch: 'text-rose-500' },
];

export function MapViewerLayerControls({ value, onChange, counts }: MapViewerLayerControlsProps) {
  return (
    <div className="border-border bg-muted/30 flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-2">
      {LAYERS.map(({ key, label, Icon, swatch }) => {
        const on = value[key];
        const count = counts[key];
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
