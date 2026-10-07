import { InfoRow } from '@/components/layout/DetailPageLayout';
import type { EquipStatRange } from '@scrolled/game-db/serverProfiles';
import { StatRange } from '@scrolled/design';

export function StatRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === 0) return null;
  return <InfoRow label={label} value={String(value)} />;
}

// Colours group stats by what they feed: offence red, magic blue, primary
// stats gold, accuracy and avoid green.
const STAT_COLOR: Record<string, string> = {
  Attack: 'var(--stat-hp)',
  Defense: 'var(--stat-hp)',
  HP: 'var(--stat-hp)',
  'Magic atk': 'var(--stat-mp)',
  'Magic def': 'var(--stat-mp)',
  MP: 'var(--stat-mp)',
  INT: 'var(--stat-mp)',
  STR: 'var(--stat-exp)',
  DEX: 'var(--stat-exp)',
  LUK: 'var(--stat-exp)',
  Accuracy: 'var(--stat-level)',
  Avoidability: 'var(--stat-level)',
};

// Like StatRow, but draws the possible dropped-stat range from the active
// server profile's calculator as a bar with the base value marked.
export function StatRangeRow({
  label,
  value,
  range,
}: {
  label: string;
  value: number | null;
  range?: EquipStatRange;
}) {
  if (value === null || value === 0) return null;
  if (!range) return <InfoRow label={label} value={String(value)} />;
  // Sits inside an InfoSection <dl>, so it needs a dt/dd pair; the bar shows
  // its own label, so the dt is for assistive tech only.
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <StatRange
          label={label}
          base={range.base}
          min={range.min}
          max={range.max}
          maxNote={range.godlyMax !== undefined ? ` or ${range.godlyMax}` : undefined}
          color={STAT_COLOR[label]}
        />
      </dd>
    </div>
  );
}

/** Requirement values as small tiles; zero requirements are left out. */
export function RequirementTiles({ items }: { items: { label: string; value: number | null }[] }) {
  const shown = items.filter((i) => i.value !== null && i.value !== 0);
  if (shown.length === 0) return null;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {shown.map((i) => (
        <div key={i.label} className="bg-muted flex flex-col items-center rounded-md px-2 py-1.5">
          <span className="font-display text-[17px] font-semibold leading-tight">{i.value}</span>
          <span className="text-muted-foreground text-[10.5px] font-bold">{i.label}</span>
        </div>
      ))}
    </div>
  );
}
