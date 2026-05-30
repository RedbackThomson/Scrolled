/**
 * Picks the largest unit that divides evenly so authored round numbers
 * (3600 → "1 hour", 86400 → "1 day") survive, and 5400 stays "90 minutes"
 * instead of collapsing to "1.5 hours".
 *
 * Pass `{ short: true }` for tight contexts (table cells, badges) — long
 * unit names become `min` / `hr` / `d`, and seconds drop the space
 * entirely (`45s`) to match conventional UI usage.
 */
export function formatDurationSeconds(
  totalSeconds: number,
  options: { short?: boolean } = {},
): string {
  const short = options.short === true;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return short ? '0s' : '0 seconds';
  }
  const s = Math.floor(totalSeconds);
  const units: { unit: number; singular: string; plural: string; short: string }[] = [
    { unit: 86400, singular: 'day', plural: 'days', short: 'd' },
    { unit: 3600, singular: 'hour', plural: 'hours', short: 'hr' },
    { unit: 60, singular: 'minute', plural: 'minutes', short: 'min' },
  ];
  for (const u of units) {
    if (s >= u.unit && s % u.unit === 0) {
      const n = s / u.unit;
      if (short) return `${n} ${u.short}`;
      return `${n} ${n === 1 ? u.singular : u.plural}`;
    }
  }
  if (short) return `${s}s`;
  return `${s} ${s === 1 ? 'second' : 'seconds'}`;
}
