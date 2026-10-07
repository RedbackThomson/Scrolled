import { PresetTile } from '@scrolled/design';
import type { ColumnFilter } from '@/db';
import { presetMatches, type ListPreset } from './presets';

interface PresetShelfProps {
  presets: readonly ListPreset[];
  filters: Record<string, ColumnFilter>;
  /** Result count per preset id; omitted while loading. */
  counts: Record<string, number | undefined>;
  /** `null` clears the filters (clicking the active preset again). */
  onApply: (preset: ListPreset | null) => void;
}

export function PresetShelf({ presets, filters, counts, onApply }: PresetShelfProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {presets.map((preset) => {
        const active = presetMatches(preset, filters);
        return (
          <PresetTile
            key={preset.id}
            icon={preset.icon}
            label={preset.label}
            hue={preset.hue}
            count={counts[preset.id]}
            active={active}
            onClick={() => onApply(active ? null : preset)}
          />
        );
      })}
    </div>
  );
}
