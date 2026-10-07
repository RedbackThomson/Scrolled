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
  const tiles = (compact: boolean) =>
    presets.map((preset) => {
      const active = presetMatches(preset, filters);
      return (
        <li key={preset.id} className={compact ? 'shrink-0 snap-start' : undefined}>
          <PresetTile
            icon={preset.icon}
            label={preset.label}
            hue={preset.hue}
            count={counts[preset.id]}
            active={active}
            compact={compact}
            onClick={() => onApply(active ? null : preset)}
          />
        </li>
      );
    });
  return (
    <>
      <ul className="grid grid-cols-2 gap-2.5 max-md:hidden sm:grid-cols-3 lg:grid-cols-6">
        {tiles(false)}
      </ul>
      {/* Vertical padding keeps the active halo from being clipped by the scroller. */}
      <ul className="-mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 py-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
        {tiles(true)}
      </ul>
    </>
  );
}
