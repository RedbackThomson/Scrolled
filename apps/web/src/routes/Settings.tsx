import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, FileText, Loader2, Moon, Sun, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDbClient } from '@/db';
import { useTheme } from '@/lib/theme';
import { shortHash } from '@/lib/hashFile';

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
