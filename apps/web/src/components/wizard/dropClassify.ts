// File-type classification for the wizard's drop zone.
//
// The wizard's drop zone now accepts two kinds of input: WZ files for a
// fresh / additive import, and SQLite backup files for a full restore.
// This helper centralizes the by-extension decision so StepFiles and any
// future callers stay in agreement on what counts as what.

export type DroppedKind = 'wz' | 'sqlite' | 'other';

export function classify(name: string): DroppedKind {
  if (/\.wz$/i.test(name)) return 'wz';
  if (/\.(sqlite3?|db)$/i.test(name)) return 'sqlite';
  return 'other';
}

export interface DropSplit {
  wz: File[];
  sqlite: File[];
  other: File[];
}

export function splitByKind(files: Iterable<File>): DropSplit {
  const out: DropSplit = { wz: [], sqlite: [], other: [] };
  for (const f of files) {
    const kind = classify(f.name);
    out[kind].push(f);
  }
  return out;
}
