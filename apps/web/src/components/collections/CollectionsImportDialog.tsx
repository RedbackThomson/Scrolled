// Two-step JSON import flow inside a single modal:
//
//   1. User picks a file. We parse + zod-validate before showing anything
//      destructive — invalid files are flagged immediately so the user
//      doesn't pick a conflict mode for data that can't be imported.
//   2. User picks a conflict resolution mode and confirms.
//
// On success we surface a counts summary; the parent closes the dialog.

import { useState, type ChangeEvent } from 'react';
import { AlertCircle, FileJson, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImportJson } from '@/lib/useCollections';
import {
  collectionsExportSchema,
  type CollectionsExportJson,
  type ImportConflictMode,
  type ImportReport,
} from '@/db/user/collectionsJson';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';

interface CollectionsImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported?: (report: ImportReport) => void;
}

const MODE_OPTIONS: { value: ImportConflictMode; label: string; description: string }[] = [
  {
    value: 'merge',
    label: 'Merge',
    description: 'Reuse existing collections by name; add any new members.',
  },
  {
    value: 'rename',
    label: 'Rename',
    description: 'Import as new collections with an "(imported)" suffix.',
  },
  {
    value: 'skip',
    label: 'Skip',
    description: 'Skip imported collections whose name already exists.',
  },
];

export function CollectionsImportDialog({
  open,
  onClose,
  onImported,
}: CollectionsImportDialogProps) {
  const [payload, setPayload] = useState<CollectionsExportJson | null>(null);
  const [filename, setFilename] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportConflictMode>('merge');
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const importM = useImportJson();

  const reset = () => {
    setPayload(null);
    setFilename(null);
    setMode('merge');
    setParseError(null);
    setReport(null);
    importM.reset();
  };

  const close = () => {
    reset();
    onClose();
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParseError(null);
    setPayload(null);
    setFilename(file.name);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const parsed = collectionsExportSchema.parse(json);
      setPayload(parsed);
    } catch (err) {
      setParseError(
        err instanceof Error ? err.message : 'Could not read this file as collections JSON.',
      );
    }
  };

  const submit = async () => {
    if (!payload) return;
    try {
      const result = await importM.mutateAsync({ payload, conflict: mode });
      setReport(result);
      onImported?.(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const ready = payload !== null && parseError === null;
  const bundleCount =
    payload === null ? 0 : payload.kind === 'collection' ? 1 : payload.collections.length;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import collections"
      description="Load a previously exported collections JSON file."
      footer={
        report ? (
          <Button type="button" size="sm" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={close}
              disabled={importM.isPending}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={submit} disabled={!ready || importM.isPending}>
              {importM.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Upload className="h-3.5 w-3.5" />
              Import
            </Button>
          </>
        )
      }
    >
      {report ? (
        <ReportPanel report={report} />
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block space-y-1">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">File</span>
            <input
              type="file"
              accept="application/json,.json"
              onChange={onPickFile}
              className="text-muted-foreground file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium"
            />
          </label>

          {filename && !parseError && payload && (
            <div className="border-border bg-muted/40 flex items-start gap-2 rounded-md border p-2 text-xs">
              <FileJson className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{filename}</div>
                <div className="text-muted-foreground">
                  {payload.kind === 'collection'
                    ? `1 collection · ${payload.collection.members.length} member${
                        payload.collection.members.length === 1 ? '' : 's'
                      }`
                    : `${bundleCount} collection${bundleCount === 1 ? '' : 's'}`}
                </div>
              </div>
            </div>
          )}

          {parseError && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border p-2 text-xs">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">Couldn't read this file</div>
                <div className="opacity-80">{parseError}</div>
              </div>
            </div>
          )}

          <fieldset className="space-y-1.5">
            <legend className="text-muted-foreground text-xs uppercase tracking-wide">
              If a collection with the same name already exists
            </legend>
            <div className="space-y-1">
              {MODE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'border-border hover:bg-accent flex cursor-pointer items-start gap-2 rounded-md border p-2 text-xs',
                    mode === opt.value && 'bg-accent border-foreground/20',
                  )}
                >
                  <input
                    type="radio"
                    name="conflict-mode"
                    value={opt.value}
                    checked={mode === opt.value}
                    onChange={() => setMode(opt.value)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-muted-foreground">{opt.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </Modal>
  );
}

function ReportPanel({ report }: { report: ImportReport }) {
  const totalCollections =
    report.createdCollections + report.mergedCollections + report.renamedCollections;
  return (
    <div className="space-y-2 text-sm">
      <p className="text-foreground">
        Imported {totalCollections} collection{totalCollections === 1 ? '' : 's'}.
      </p>
      <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <ReportRow label="Created" value={report.createdCollections} />
        <ReportRow label="Merged" value={report.mergedCollections} />
        <ReportRow label="Renamed" value={report.renamedCollections} />
        <ReportRow label="Skipped" value={report.skippedCollections} />
        <ReportRow label="Members added" value={report.addedMembers} />
        <ReportRow label="Members already present" value={report.skippedMembers} />
      </dl>
      {report.importedNames.length > 0 && (
        <div className="border-border bg-muted/40 rounded-md border p-2 text-xs">
          <div className="text-muted-foreground mb-1 uppercase tracking-wide">Imported names</div>
          <ul className="list-disc space-y-0.5 pl-4">
            {report.importedNames.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt>{label}</dt>
      <dd className="text-foreground text-right font-mono tabular-nums">{value}</dd>
    </>
  );
}
