import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  XCircle,
} from 'lucide-react';
import type { DatasetRecord } from '@/db';
import { extractorLabel } from '@/components/common/extractorCatalog';
import { shortHash } from '@/lib/hashFile';
import { cn } from '@scrolled/ui';

type Tone = 'green' | 'amber' | 'red' | 'gray';

const TONE_BADGE: Record<Tone, string> = {
  green: 'bg-green-500/15 text-green-700 dark:text-green-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  gray: 'bg-muted text-muted-foreground',
};

interface RunSummary {
  badge: { label: string; tone: Tone; icon: typeof CheckCircle2 };
  warnings: string[];
}

function summarize(d: DatasetRecord): RunSummary {
  const warnings: string[] = [];
  const loadFailures = d.files.filter((f) => f.loadStatus === 'load_failed');
  const extractorErrors = d.extractors.filter((e) => e.error);
  const placeholders = d.extractors.reduce((a, e) => a + e.placeholderNames, 0);

  for (const f of loadFailures) {
    warnings.push(`${f.name} failed to load${f.loadError ? `: ${f.loadError}` : ''}`);
  }
  for (const e of extractorErrors) {
    warnings.push(`${extractorLabel(e.extractor)} errored: ${e.error}`);
  }
  if (placeholders > 0) {
    warnings.push(`${placeholders.toLocaleString()} record(s) used placeholder names`);
  }

  if (d.ok === null) {
    return {
      badge: { label: 'Legacy', tone: 'gray', icon: FileText },
      warnings,
    };
  }
  if (!d.ok || loadFailures.length > 0 || extractorErrors.length > 0) {
    return {
      badge: {
        label: !d.ok ? 'Failed' : 'Issues',
        tone: !d.ok ? 'red' : 'amber',
        icon: !d.ok ? XCircle : AlertTriangle,
      },
      warnings,
    };
  }
  if (placeholders > 0) {
    return {
      badge: { label: 'Partial names', tone: 'amber', icon: AlertTriangle },
      warnings,
    };
  }
  return {
    badge: { label: 'OK', tone: 'green', icon: CheckCircle2 },
    warnings,
  };
}

export function RunCard({ dataset: d }: { dataset: DatasetRecord }) {
  const summary = summarize(d);
  const BadgeIcon = summary.badge.icon;
  const ranExtractors = d.extractors.filter((e) => e.status === 'ran');
  const skippedExtractors = d.extractors.filter((e) => e.status === 'skipped');
  const totalRows = ranExtractors.reduce((acc, e) => acc + e.rows, 0);

  return (
    <li className="border-border rounded-md border">
      <details className="group">
        <summary className="hover:bg-accent/40 flex cursor-pointer flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm">
          <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" />
          <span className="font-medium">{d.label}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium',
              TONE_BADGE[summary.badge.tone],
            )}
          >
            <BadgeIcon className="h-3 w-3" />
            {summary.badge.label}
          </span>
          <span className="text-muted-foreground basis-full text-xs md:ml-auto md:basis-auto md:text-right">
            {new Date(d.loadedAt).toLocaleString()}
            {d.totalMs !== null && <> · {(d.totalMs / 1000).toFixed(1)}s</>}
            {' · '}
            {totalRows.toLocaleString()} rows
          </span>
        </summary>

        <div className="border-border space-y-3 border-t p-3 text-xs">
          {summary.warnings.length > 0 && (
            <ul className="space-y-1">
              {summary.warnings.map((w, i) => (
                <li key={i} className="text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mr-1.5 inline h-3 w-3" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <div>
            <div className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
              Files ({d.files.length})
            </div>
            <ul className="space-y-0.5">
              {d.files.map((f) => (
                <li key={f.name} className="flex items-center gap-2 font-mono">
                  {f.loadStatus === 'load_failed' ? (
                    <XCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
                  )}
                  <span className="truncate">{f.name}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">
                    {f.size !== null ? `${(f.size / 1_000_000).toFixed(1)} MB` : '—'}
                    {f.hash && (
                      <span className="ml-2" title={f.hash}>
                        sha256:{shortHash(f.hash)}…
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {d.extractors.length > 0 && (
            <div>
              <div className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wide">
                Extractors
              </div>
              <ul className="space-y-0.5">
                {ranExtractors.map((e) => (
                  <li key={e.extractor} className="flex items-center gap-2">
                    {e.error ? (
                      <XCircle className="h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-green-600 dark:text-green-400" />
                    )}
                    <span className="w-16 shrink-0">{extractorLabel(e.extractor)}</span>
                    <span className="text-foreground/80 font-mono">
                      {e.rows.toLocaleString()} rows
                    </span>
                    {e.skippedRows > 0 && (
                      <span className="text-muted-foreground">
                        · {e.skippedRows.toLocaleString()} skipped
                      </span>
                    )}
                    {e.placeholderNames > 0 && (
                      <span className="text-amber-700 dark:text-amber-300">
                        · {e.placeholderNames.toLocaleString()} placeholder name
                        {e.placeholderNames === 1 ? '' : 's'}
                      </span>
                    )}
                    {e.error && <span className="text-red-700 dark:text-red-300">· {e.error}</span>}
                  </li>
                ))}
                {skippedExtractors.length > 0 && (
                  <li className="text-muted-foreground">
                    Skipped:{' '}
                    {skippedExtractors.map((e) => extractorLabel(e.extractor)).join(', ')}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </details>
    </li>
  );
}
