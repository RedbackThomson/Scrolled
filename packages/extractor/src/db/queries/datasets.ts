import type { Sqlite } from '../sqlite';
import { CURRENT_DATA_REVISION } from '../dataVersion';
import type { DatasetFileRef, DatasetRecord, ExtractorResultRecord } from '../types';
import { deleteMeta, setMeta } from './meta';

export function recordDataset(
  sql: Sqlite,
  input: {
    label: string;
    wzVersion: string;
    sourceKind?: 'wz' | 'img';
    files: DatasetFileRef[];
    notes?: string;
    totalMs?: number;
    ok?: boolean;
    extractors?: ExtractorResultRecord[];
  },
): DatasetRecord {
  return sql.transaction(() => {
    sql.exec(
      `INSERT INTO datasets (label, loaded_at, wz_version, source_kind, notes, total_ms, ok)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.label,
        Date.now(),
        input.wzVersion,
        input.sourceKind ?? 'wz',
        input.notes ?? null,
        input.totalMs ?? null,
        input.ok === undefined ? null : input.ok ? 1 : 0,
      ],
    );
    const id = Number(sql.selectValue('SELECT last_insert_rowid()'));
    // INSERT OR REPLACE so we self-heal from any orphaned rows whose
    // dataset_id was recycled by AUTOINCREMENT after a `clearAllData`
    // that pre-dated the fix to also clear these child tables.
    for (const f of input.files) {
      sql.exec(
        `INSERT OR REPLACE INTO dataset_files
           (dataset_id, name, size, hash, load_status, load_error)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, f.name, f.size ?? null, f.hash ?? null, f.loadStatus ?? null, f.loadError ?? null],
      );
    }
    for (const e of input.extractors ?? []) {
      sql.exec(
        `INSERT OR REPLACE INTO extraction_extractors
           (dataset_id, extractor, status, rows, skipped_rows, placeholder_names, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, e.extractor, e.status, e.rows, e.skippedRows, e.placeholderNames, e.error ?? null],
      );
    }
    // A clean run stamps the library as produced by this build's data
    // contract and clears the rebuild flag, dismissing any "reinitialize /
    // re-index" prompt. A failed run leaves both untouched. See
    // db/dataVersion.ts.
    if (input.ok === true) {
      setMeta(sql, 'data_revision', String(CURRENT_DATA_REVISION));
      deleteMeta(sql, 'pending_rebuild');
    }
    return readDataset(sql, id)!;
  });
}

export function listDatasets(sql: Sqlite): DatasetRecord[] {
  const ids = sql
    .selectObjects<{ id: number }>('SELECT id FROM datasets ORDER BY loaded_at DESC')
    .map((r) => r.id);
  return ids.map((id) => readDataset(sql, id)!).filter(Boolean);
}

export function listLoadedFileNames(sql: Sqlite): string[] {
  return sql
    .selectObjects<{ name: string }>('SELECT DISTINCT name FROM dataset_files ORDER BY name')
    .map((r) => r.name);
}

export function findFileByHash(sql: Sqlite, hash: string): DatasetFileRef | null {
  if (!hash) return null;
  const row = sql.selectObject<{
    name: string;
    size: number | null;
    hash: string | null;
    load_status: string | null;
    load_error: string | null;
  }>(
    `SELECT df.name, df.size, df.hash, df.load_status, df.load_error
     FROM dataset_files df
     JOIN datasets d ON d.id = df.dataset_id
     WHERE df.hash = ?
     ORDER BY d.loaded_at DESC
     LIMIT 1`,
    [hash],
  );
  return row
    ? {
        name: row.name,
        size: row.size,
        hash: row.hash,
        loadStatus: (row.load_status as DatasetFileRef['loadStatus']) ?? null,
        loadError: row.load_error,
      }
    : null;
}

function readDataset(sql: Sqlite, id: number): DatasetRecord | null {
  const ds = sql.selectObject<{
    id: number;
    label: string;
    loaded_at: number;
    wz_version: string;
    source_kind: string | null;
    notes: string | null;
    total_ms: number | null;
    ok: number | null;
  }>('SELECT * FROM datasets WHERE id = ?', [id]);
  if (!ds) return null;
  const files = sql.selectObjects<{
    name: string;
    size: number | null;
    hash: string | null;
    load_status: string | null;
    load_error: string | null;
  }>(
    `SELECT name, size, hash, load_status, load_error
     FROM dataset_files WHERE dataset_id = ? ORDER BY name`,
    [id],
  );
  const extractors = sql.selectObjects<{
    extractor: string;
    status: string;
    rows: number;
    skipped_rows: number;
    placeholder_names: number;
    error: string | null;
  }>(
    `SELECT extractor, status, rows, skipped_rows, placeholder_names, error
     FROM extraction_extractors WHERE dataset_id = ? ORDER BY extractor`,
    [id],
  );
  return {
    id: ds.id,
    label: ds.label,
    loadedAt: ds.loaded_at,
    wzVersion: ds.wz_version,
    sourceKind: ds.source_kind === 'img' ? 'img' : 'wz',
    notes: ds.notes,
    totalMs: ds.total_ms,
    ok: ds.ok === null ? null : ds.ok === 1,
    files: files.map((f) => ({
      name: f.name,
      size: f.size,
      hash: f.hash,
      loadStatus: (f.load_status as DatasetFileRef['loadStatus']) ?? null,
      loadError: f.load_error,
    })),
    extractors: extractors.map((e) => ({
      extractor: e.extractor,
      status: e.status as ExtractorResultRecord['status'],
      rows: e.rows,
      skippedRows: e.skipped_rows,
      placeholderNames: e.placeholder_names,
      error: e.error,
    })),
  };
}
