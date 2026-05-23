import { cn } from '@/lib/utils';
import type { ProgressUpdate } from '@/lib/progress';

interface Props {
  progress: ProgressUpdate | null;
  className?: string;
}

/**
 * Renders a `ProgressUpdate` as a labelled bar. If `total` is set and > 0 the
 * bar is determinate (filled to current/total). Otherwise it animates as
 * indeterminate.
 */
export function ProgressBar({ progress, className }: Props) {
  if (!progress) return null;
  const determinate = typeof progress.total === 'number' && progress.total > 0;
  const pct = determinate
    ? Math.min(100, Math.max(0, (progress.current / progress.total!) * 100))
    : null;

  return (
    <div className={cn('space-y-1.5', className)} aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <div className="min-w-0">
          <div className="text-foreground truncate text-sm font-medium">{progress.phase}</div>
          {progress.detail && (
            <div className="text-muted-foreground truncate font-mono">{progress.detail}</div>
          )}
        </div>
        <div className="text-muted-foreground shrink-0 font-mono">
          {determinate
            ? `${formatCount(progress.current)} / ${formatCount(progress.total!)} · ${pct!.toFixed(0)}%`
            : formatCount(progress.current)}
        </div>
      </div>
      <div className="bg-muted relative h-1.5 w-full overflow-hidden rounded-full">
        {determinate ? (
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-150 ease-linear"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="bg-primary/60 absolute inset-y-0 w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full" />
        )}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
