import { InfoRow } from '@/components/layout/DetailPageLayout';
import type { EquipStatRange } from '@/serverProfiles';

export function StatRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === 0) return null;
  return <InfoRow label={label} value={String(value)} />;
}

// Like StatRow, but shows the possible dropped-stat range from the active
// server profile's calculator alongside the base value.
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
  return (
    <InfoRow
      label={label}
      value={
        <span>
          {range.base.toLocaleString()}{' '}
          <span className="text-muted-foreground text-xs">
            ({range.min} ~ {range.max}
            {range.godlyMax !== undefined ? ` or ${range.godlyMax}` : ''})
          </span>
        </span>
      }
    />
  );
}
