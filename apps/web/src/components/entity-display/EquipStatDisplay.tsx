import { InfoRow } from '@scrolled/design';
import type { EquipStatRange } from '@scrolled/game-db/serverProfiles';

export function StatRow({ label, value }: { label: string; value: number | null }) {
  if (value === null || value === 0) return null;
  return <InfoRow label={label} value={String(value)} />;
}

// Like StatRow, plus the range a dropped copy can roll under the active server
// profile, so players can judge whether theirs is a good one.
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
        <span className="tabular-nums">
          {range.base}{' '}
          <span className="text-muted-foreground text-[12.5px] font-normal">
            ({range.min} ~ {range.max}
            {range.godlyMax !== undefined && ` or ${range.godlyMax}`})
          </span>
        </span>
      }
    />
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
