import { useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  Download,
  FileText,
  Loader2,
  Moon,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDbClient } from '@/db';
import { useTheme } from '@/lib/theme';
import { shortHash } from '@/lib/hashFile';
import { createLogger, describeError } from '@/lib/logger';

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
        'Clear all data from the local database? Loaded items, mobs, NPCs, maps, and dataset records will be deleted. Your WZ files on disk are untouched.',
      )
    ) {
      clearM.mutate();
    }
  }, [clearM]);

  const exportM = useMutation({
    mutationFn: async () => {
      const bytes = await db.exportBytes();
      const blob = new Blob([bytes], { type: 'application/vnd.sqlite3' });
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
          `This will discard everything currently in your local database. Your WZ files on disk are untouched.`,
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
        <p className="text-muted-foreground mt-2 text-sm">
          Manage your locally stored data and appearance preferences.
        </p>
      </header>

      {/* --- Data ----------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <h2 className="text-lg font-semibold">Data</h2>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <h3 className="text-sm font-semibold">Loaded WZ files</h3>
          {datasetsQ.isLoading && (
            <p className="text-muted-foreground mt-2 text-sm">
              <Loader2 className="inline h-3 w-3 animate-spin" /> Loading…
            </p>
          )}
          {datasetsQ.data && datasetsQ.data.length === 0 && (
            <p className="text-muted-foreground mt-2 text-sm">
              No WZ files loaded yet. Start by setting up your wiki.
            </p>
          )}
          {datasetsQ.data && datasetsQ.data.length > 0 && (
            <ul className="mt-3 space-y-3">
              {datasetsQ.data.map((d) => (
                <li key={d.id} className="border-border rounded-md border p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-sm font-medium">{d.label}</div>
                    <div className="text-muted-foreground text-xs">
                      {new Date(d.loadedAt).toLocaleString()} · {d.wzVersion}
                    </div>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {d.files.map((f) => (
                      <li
                        key={f.name}
                        className="text-muted-foreground flex items-center gap-2 font-mono text-xs"
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <span className="ml-auto shrink-0">
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
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              to="/setup"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium"
            >
              <Upload className="h-4 w-4" />
              Manage WZ files
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={clearM.isPending || (statusQ.data && statusQ.data.counts.datasets === 0)}
            >
              {clearM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Clear database
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Re-running setup is additive — existing data stays, new files extend it. Clearing wipes
            everything and requires running setup again.
          </p>
        </div>

        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <h3 className="text-sm font-semibold">Database file</h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Export the local database as a <code className="font-mono">.sqlite3</code> file —
            useful for sharing a pre-built index or backing up before clearing. Import replaces
            everything currently stored on this device.
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
              accept=".sqlite3,.sqlite,.db,application/vnd.sqlite3"
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
    </div>
  );
}
