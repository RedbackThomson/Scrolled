// Human-readable travel times for the directions UI. Input is seconds, as
// produced by the nav-graph weighted pathfinder.

/** Format a duration in seconds as e.g. "45s", "2m 30s", "1h 5m". */
export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  if (total <= 0) return 'instant';

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join(' ');
}
