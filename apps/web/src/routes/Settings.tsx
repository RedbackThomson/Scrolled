import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  FileText,
  Loader2,
  Moon,
  Shield,
  Sun,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBytes, todayStamp } from '@/components/collections';
import { getDbClient, type DatasetRecord } from '@/db';
import {
  useCollectionsList,
  useExportUserDbBytes,
  useImportUserDbBytes,
} from '@/lib/useCollections';
import { useTheme } from '@/lib/theme';
import {
  isAnalyticsAvailable,
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from '@/lib/analytics';
import { shortHash } from '@/lib/hashFile';
import { createLogger, describeError } from '@/lib/logger';
import { acceptForDesktop } from '@/lib/filePickerAccept';
import { cn } from '@/lib/utils';

const log = createLogger('settings');

export default function Settings() {
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.set);

  const datasetsQ = useQuery({
    queryKey: ['db', 'datasets'],
    queryFn: () => db.listDatasets(),
  });
  const statusQ = useQuery({
    queryKey: ['db', 'status'],
    queryFn: () => db.status(),
  });

  const clearM = useMutation({
    mutationFn: () => db.clearAllData(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['db'] }),
  });

  const onClear = useCallback(() => {
    if (
      confirm(
        'Clear all data from the local library? Every loaded item, mob, NPC, map, and quest will be removed. Your game files on disk are untouched.',
      )
    ) {
      clearM.mutate();
    }
  }, [clearM]);

  const exportM = useMutation({
    mutationFn: async () => {
      const bytes = await db.exportBytes();
      // TS's new BlobPart typing rejects `Uint8Array<ArrayBufferLike>` (it
      // accepts only `ArrayBufferView<ArrayBuffer>`). The bytes are real
      // backing-store ArrayBuffer at runtime; cast at the boundary.
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: 'application/vnd.sqlite3',
      });
      const url = URL.createObjectURL(blob);
      try {
        const today = new Date().toISOString().slice(0, 10);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `mushroom-explorer-${today}.sqlite3`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      return { bytes: bytes.byteLength };
    },
    onError: (e) => log.error('export failed', describeError(e)),
  });

  const importInputRef = useRef<HTMLInputElement>(null);
  const importM = useMutation({
    mutationFn: async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return db.importBytes(bytes);
    },
    onSuccess: (result) => {
      log.info('import complete', result);
      queryClient.invalidateQueries({ queryKey: ['db'] });
    },
    onError: (e) => log.error('import failed', describeError(e)),
  });

  const onImportPicked = useCallback(
    (file: File) => {
      const sizeMb = (file.size / 1_000_000).toFixed(1);
      const proceed = confirm(
        `Replace the current database with ${file.name} (${sizeMb} MB)?\n\n` +
          `This will discard everything currently in your local database. Your game files on disk are untouched.`,
      );
      if (!proceed) return;
      importM.mutate(file);
    },
    [importM],
  );

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      </header>

      {/* --- Database health ----------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Database health</h2>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          {statusQ.isLoading ? (
            <p className="text-muted-foreground text-sm">
              <Loader2 className="text-muted-foreground inline h-4 w-4 animate-spin" /> Connecting
              to local database…
            </p>
          ) : statusQ.error ? (
            <p className="text-destructive text-sm">{(statusQ.error as Error).message}</p>
          ) : statusQ.data ? (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Database className="h-4 w-4" />
                Local database
                <span
                  className={cn(
                    'text-foreground/80 ml-2 rounded px-2 py-0.5 text-xs font-medium',
                    statusQ.data.backend === 'opfs' ? 'bg-green-500/15' : 'bg-amber-500/15',
                  )}
                >
                  {statusQ.data.backend === 'opfs'
                    ? 'OPFS (persistent)'
                    : 'memory (not persistent)'}
                </span>
                <span className="text-muted-foreground ml-auto text-xs">
                  schema v{statusQ.data.schemaVersion}
                </span>
              </div>
              <dl className="text-muted-foreground mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-7">
                {(
                  [
                    ['items', statusQ.data.counts.items],
                    ['equips', statusQ.data.counts.equips],
                    ['mobs', statusQ.data.counts.mobs],
                    ['npcs', statusQ.data.counts.npcs],
                    ['maps', statusQ.data.counts.maps],
                    ['quests', statusQ.data.counts.quests],
                    ['datasets', statusQ.data.counts.datasets],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label}>
                    <dt className="uppercase tracking-wide">{label}</dt>
                    <dd className="text-foreground font-mono text-sm">{count}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClear}
                  disabled={clearM.isPending || statusQ.data.counts.datasets === 0}
                >
                  {clearM.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Clear database
                </Button>
                <p className="text-muted-foreground text-xs">
                  Removes every loaded entity from your library. Your game files on disk are
                  untouched.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* --- Data ----------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Data</h2>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <h3 className="text-sm font-semibold">Recent setup runs</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Each setup run records which files were loaded and what was indexed. Expand a row to see
            per-file results and counts.
          </p>
          {datasetsQ.isLoading && (
            <p className="text-muted-foreground mt-2 text-sm">
              <Loader2 className="inline h-3 w-3 animate-spin" /> Loading…
            </p>
          )}
          {datasetsQ.data && datasetsQ.data.length === 0 && (
            <p className="text-muted-foreground mt-2 text-sm">
              No game files loaded yet. Start by setting up your wiki.
            </p>
          )}
          {datasetsQ.data && datasetsQ.data.length > 0 && (
            <ul className="mt-3 space-y-2">
              {datasetsQ.data.slice(0, 5).map((d) => (
                <RunCard key={d.id} dataset={d} />
              ))}
              {datasetsQ.data.length > 5 && (
                <li className="text-muted-foreground pt-1 text-xs">
                  …{datasetsQ.data.length - 5} older run
                  {datasetsQ.data.length - 5 === 1 ? '' : 's'} not shown.
                </li>
              )}
            </ul>
          )}
          <div className="mt-4">
            <Link
              to="/setup"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium"
            >
              <Upload className="h-4 w-4" />
              Manage game files
            </Link>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Re-running setup is additive — existing data stays, new files extend it.
          </p>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <h3 className="text-sm font-semibold">Database file</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Save your library as a backup file, or restore from one. Useful for moving between
            browsers or sharing a pre-built library. Importing replaces everything currently on this
            device.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportM.mutate()}
              disabled={
                exportM.isPending ||
                importM.isPending ||
                (statusQ.data && statusQ.data.counts.datasets === 0)
              }
            >
              {exportM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export database
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
              disabled={exportM.isPending || importM.isPending}
            >
              {importM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Import database
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept={acceptForDesktop('.sqlite3,.sqlite,.db,application/vnd.sqlite3')}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onImportPicked(file);
              }}
            />
            {exportM.data && !exportM.isPending && (
              <span className="text-muted-foreground text-xs">
                Exported {(exportM.data.bytes / 1_000_000).toFixed(1)} MB
              </span>
            )}
            {importM.isSuccess && !importM.isPending && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Import complete · schema v{importM.data.schemaVersion}
              </span>
            )}
          </div>
          {(exportM.error || importM.error) && (
            <p className="text-destructive mt-3 text-xs">
              {((exportM.error ?? importM.error) as Error).message}
            </p>
          )}
        </div>
      </section>

      {/* --- User data ------------------------------------------------------ */}
      <UserDataSection />

      {/* --- Appearance ----------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <h2 className="text-lg font-semibold">Appearance</h2>
        </div>
        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Theme</div>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Choose how the app looks. Defaults to your system preference on first load.
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs">
              {(['light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={
                    theme === t
                      ? 'bg-primary text-primary-foreground rounded px-2.5 py-1.5 capitalize'
                      : 'text-muted-foreground hover:text-foreground rounded px-2.5 py-1.5 capitalize'
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- Privacy -------------------------------------------------------- */}
      <PrivacySection />
    </div>
  );
}

// Pageview analytics only render on the canonical hosted deployment. On a
// fork, local dev, or self-hosted build, the env vars are absent and the
// section is hidden entirely.
function PrivacySection() {
  const available = isAnalyticsAvailable();
  if (!available) return null;
  return <PrivacySectionInner />;
}

function PrivacySectionInner() {
  const [optedOut, setOptedOut] = useState(() => isAnalyticsOptedOut());
  const onToggle = (next: boolean) => {
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Privacy</h2>
      </div>
      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Anonymous pageview analytics</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The hosted version of this app counts page visits via a third-party beacon. No
              identifiers, no event payloads, no game data — just which page was viewed. Disable to
              skip the beacon on this device. Reload to apply.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!optedOut}
            onClick={() => onToggle(!optedOut)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              optedOut ? 'bg-muted' : 'bg-primary',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                optedOut ? 'translate-x-0.5' : 'translate-x-4',
              )}
            />
          </button>
        </div>
      </div>
    </section>
  );
}

const EXTRACTOR_LABELS: Record<string, string> = {
  item: 'Items',
  equip: 'Equips',
  mob: 'Mobs',
  npc: 'NPCs',
  map: 'Maps',
  quest: 'Quests',
};

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
    warnings.push(`${EXTRACTOR_LABELS[e.extractor] ?? e.extractor} errored: ${e.error}`);
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

function RunCard({ dataset: d }: { dataset: DatasetRecord }) {
  const summary = summarize(d);
  const BadgeIcon = summary.badge.icon;
  const ranExtractors = d.extractors.filter((e) => e.status === 'ran');
  const skippedExtractors = d.extractors.filter((e) => e.status === 'skipped');
  const totalRows = ranExtractors.reduce((acc, e) => acc + e.rows, 0);

  return (
    <li className="border-border rounded-md border">
      <details className="group">
        <summary className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm">
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
          <span className="text-muted-foreground ml-auto shrink-0 text-xs">
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
                    <span className="w-16 shrink-0">
                      {EXTRACTOR_LABELS[e.extractor] ?? e.extractor}
                    </span>
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
                    {skippedExtractors
                      .map((e) => EXTRACTOR_LABELS[e.extractor] ?? e.extractor)
                      .join(', ')}
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

/**
 * User-data section. Collections live in a separate OPFS SQLite file from
 * the game data, so they need their own export/import controls. JSON
 * import/export is offered on the /collections page (cleaner home for the
 * full-library flow); this panel handles the raw `.sqlite3` file form for
 * power users who want a literal bit-for-bit backup.
 */
function UserDataSection() {
  const collectionsQ = useCollectionsList();
  const exportM = useExportUserDbBytes();
  const importM = useImportUserDbBytes();
  const importInputRef = useRef<HTMLInputElement>(null);

  const onExport = async () => {
    const bytes = await exportM.mutateAsync();
    downloadBytes(
      `mushroom-explorer-collections-${todayStamp()}.sqlite3`,
      bytes,
      'application/vnd.sqlite3',
    );
  };

  const onImportPicked = useCallback(
    async (file: File) => {
      const sizeKb = (file.size / 1024).toFixed(0);
      const proceed = confirm(
        `Replace your collections with ${file.name} (${sizeKb} KB)?\n\n` +
          `Every collection currently saved on this device will be discarded.`,
      );
      if (!proceed) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      importM.mutate(bytes);
    },
    [importM],
  );

  const collectionCount = collectionsQ.data?.length ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4" />
        <h2 className="text-lg font-semibold">User data</h2>
      </div>

      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <h3 className="text-sm font-semibold">Collections</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          You have {collectionCount.toLocaleString()} collection{collectionCount === 1 ? '' : 's'}.
          Manage them, import from JSON, or export them on the{' '}
          <Link to="/collections" className="text-primary hover:underline">
            Collections page
          </Link>
          .
        </p>
      </div>

      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <h3 className="text-sm font-semibold">Collections backup</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Back up your collections as a single file, or restore from one. Importing replaces every
          collection currently on this device.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={exportM.isPending || importM.isPending || collectionCount === 0}
            title={collectionCount === 0 ? 'No collections to export yet' : undefined}
          >
            {exportM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export user database
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            disabled={exportM.isPending || importM.isPending}
          >
            {importM.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Import user database
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept={acceptForDesktop('.sqlite3,.sqlite,.db,application/vnd.sqlite3')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void onImportPicked(file);
            }}
          />
          {exportM.data && !exportM.isPending && (
            <span className="text-muted-foreground text-xs">
              Exported {(exportM.data.byteLength / 1024).toFixed(0)} KB
            </span>
          )}
          {importM.isSuccess && !importM.isPending && (
            <span className="text-xs text-green-600 dark:text-green-400">
              Import complete · schema v{importM.data.schemaVersion}
            </span>
          )}
        </div>
        {(exportM.error || importM.error) && (
          <p className="text-destructive mt-3 text-xs">
            {((exportM.error ?? importM.error) as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}
