import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ChevronDown, Download, Loader2, Upload } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { Button } from '@/components/ui/button';
import { useExportBackup, useImportBackup, type BackupScope } from '@/hooks/useBackup';
import { acceptForDesktop } from '@/lib/filePickerAccept';
import { appConfig } from '@/config';

const EXPORT_SCOPES: { scope: BackupScope; label: string; hint: string }[] = [
  { scope: 'all', label: 'Everything', hint: 'Game data and collections' },
  { scope: 'game', label: 'Game data only', hint: 'Items, mobs, maps, quests' },
  { scope: 'user', label: 'Collections only', hint: 'Your saved collections' },
];

export function BackupSection() {
  const sectionProps = useSettingsSection('import-export');
  // Export stays available everywhere (the user owns their local copy); restore
  // is an import path and is hidden on fixed-dataset deployments.
  const canImport = appConfig.features.enableUserImport;
  const exportM = useExportBackup();
  const importM = useImportBackup();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const busy = exportM.isPending || importM.isPending;

  const runExport = (scope: BackupScope) => {
    setMenuOpen(false);
    exportM.mutate(scope);
  };

  const onImportPicked = useCallback(
    (file: File) => {
      const sizeMb = (file.size / 1_000_000).toFixed(1);
      const proceed = confirm(
        `Restore from ${file.name} (${sizeMb} MB)?\n\n` +
          `This replaces the databases the backup contains with its contents. Your game files on disk are untouched.`,
      );
      if (!proceed) return;
      importM.mutate(file);
    },
    [importM],
  );

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Archive className="h-4 w-4" />
        <h2 className="text-lg font-semibold">{canImport ? 'Import & Export' : 'Backup'}</h2>
      </div>

      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <h3 className="text-sm font-semibold">Backup file</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          {canImport
            ? 'Save your library and collections as a single backup file, or restore from one. Useful for moving between browsers or sharing a pre-built library. Importing replaces whatever the backup contains.'
            : 'Save your library and collections as a single backup file. Useful for moving between browsers or keeping an offline copy.'}{' '}
          To export collections as JSON, use the{' '}
          <Link to="/collections" className="text-primary hover:underline">
            Collections page
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="relative inline-flex" ref={menuRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-r-none"
              onClick={() => runExport('all')}
              disabled={busy}
            >
              {exportM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export backup
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-l-none border-l-0 px-2"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Choose what to export"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={busy}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            {menuOpen && (
              <div
                role="menu"
                className="border-border bg-card text-card-foreground absolute left-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-md border py-1 shadow-md"
              >
                {EXPORT_SCOPES.map(({ scope, label, hint }) => (
                  <button
                    key={scope}
                    type="button"
                    role="menuitem"
                    onClick={() => runExport(scope)}
                    className="hover:bg-accent flex w-full flex-col items-start px-3 py-1.5 text-left"
                  >
                    <span className="text-sm">{label}</span>
                    <span className="text-muted-foreground text-xs">{hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {canImport && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => importInputRef.current?.click()}
                disabled={busy}
              >
                {importM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Import backup
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept={acceptForDesktop('.scrolled-backup,.sqlite3,.sqlite,.db,application/gzip')}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) onImportPicked(file);
                }}
              />
            </>
          )}
          {exportM.data && !exportM.isPending && (
            <span className="text-muted-foreground text-xs">
              Saved {exportM.data.filename} ({(exportM.data.byteLength / 1_000_000).toFixed(1)} MB)
            </span>
          )}
          {importM.isSuccess && !importM.isPending && (
            <span className="text-xs text-green-600 dark:text-green-400">
              Restored {importM.data.imported.join(' + ') || 'nothing'}
              {importM.data.legacy ? ' (legacy file)' : ''}
            </span>
          )}
        </div>
        {importM.isSuccess &&
          importM.data.warnings.map((w) => (
            <p key={w} className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              {w}
            </p>
          ))}
        {(exportM.error || importM.error) && (
          <p className="text-destructive mt-3 text-xs">
            {((exportM.error ?? importM.error) as Error).message}
          </p>
        )}
      </div>
    </section>
  );
}
