import type { Diagnostics } from '@/parser';
import type { DatasetRecord } from '@/db';
import { getLogEntries, type LogEntry } from '@/lib/logger';
import { shortHash } from '@/lib/hashFile';

interface ReportInput {
  workerDiagnostics: Diagnostics;
  /** Optional DB-backed dataset records — give us file fingerprints across
   *  page reloads even when the parser worker has no files open. */
  datasets?: DatasetRecord[];
}

/**
 * Build a single human-readable report suitable for pasting into a GitHub
 * issue. Merges main-thread + worker log buffers by timestamp, surfaces the
 * AES smoke test, the parser worker's in-memory loaded files, and (when
 * provided) the persisted dataset records with their SHA-256 fingerprints.
 */
export function buildReport(input: ReportInput | Diagnostics): string {
  // Back-compat: original signature took Diagnostics directly.
  const { workerDiagnostics, datasets }: ReportInput =
    'workerDiagnostics' in input ? input : { workerDiagnostics: input };

  const mainLog = getLogEntries().map(taggedEntry('main'));
  const workerLog = workerDiagnostics.log.map(taggedEntry('worker'));
  const merged = [...mainLog, ...workerLog].sort((a, b) => a.t - b.t);

  const lines: string[] = [];
  lines.push('## Mushroom Game Explorer — diagnostics');
  lines.push('');
  lines.push('### Environment');
  for (const [k, v] of Object.entries(env())) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');
  lines.push('### AES smoke test');
  if (workerDiagnostics.aesSmokeTest.ok) {
    lines.push('- ok: true');
  } else {
    lines.push('- ok: false');
    lines.push(`- error: ${workerDiagnostics.aesSmokeTest.error}`);
  }
  lines.push('');
  lines.push('### Files open in parser worker (this session)');
  if (workerDiagnostics.loadedFiles.length === 0) {
    lines.push('(none)');
  } else {
    for (const f of workerDiagnostics.loadedFiles) lines.push(`- ${f.name}`);
  }
  lines.push('');
  lines.push('### Persisted datasets');
  if (!datasets || datasets.length === 0) {
    lines.push('(none recorded)');
  } else {
    for (const d of datasets) {
      lines.push(`- ${d.label} · ${d.wzVersion} · ${new Date(d.loadedAt).toISOString()}`);
      for (const f of d.files) {
        const size = f.size !== null ? `${(f.size / 1_000_000).toFixed(1)}MB` : '?MB';
        const hash = f.hash ? `sha256:${shortHash(f.hash)}…` : 'sha256:?';
        lines.push(`  - ${f.name} · ${size} · ${hash}`);
      }
    }
  }
  lines.push('');
  lines.push('### Log');
  for (const e of merged) {
    const time = new Date(e.t).toISOString().slice(11, 23);
    const data = e.data !== undefined ? ' ' + safeStringify(e.data) : '';
    lines.push(`${time} ${e.source}/${e.scope} ${e.level.toUpperCase()}: ${e.msg}${data}`);
  }
  return lines.join('\n');
}

function env(): Record<string, string> {
  return {
    userAgent: (globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent ?? '?',
    url: (globalThis as { location?: { href?: string } }).location?.href ?? '?',
    timestamp: new Date().toISOString(),
  };
}

function taggedEntry(source: 'main' | 'worker') {
  return (e: LogEntry) => ({ ...e, source });
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
