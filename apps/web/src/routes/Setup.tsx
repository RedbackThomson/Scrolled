import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Info, Loader2 } from 'lucide-react';
import { detectVersion } from '@mge/wz';
import { Button } from '@/components/ui/button';
import { WizardLayout, type WizardStep } from '@/components/wizard/WizardLayout';
import {
  StepFiles,
  type DetectionState,
  type WizardFile,
} from '@/components/wizard/StepFiles';
import { StepRun } from '@/components/wizard/StepRun';
import { StepRestore, type RestoreState } from '@/components/wizard/StepRestore';
import { buildPlan } from '@/components/wizard/plan';
import { getDbClient } from '@/db';
import { createLogger, describeError } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useWizardMode } from '@/lib/useWizardMode';
import type { WzMapleVersionName } from '@/parser';

const log = createLogger('setup');

const STEPS: WizardStep[] = [
  { id: 'files', label: 'Files' },
  { id: 'run', label: 'Run' },
];

/**
 * How many bytes from the front of a file we hand `detectVersion`. The WZ
 * root directory + companion strings live near the start, well within this
 * window; deeper sub-directories may reference offsets beyond it but
 * `readDirectory` swallows those failures and we score on root-level
 * names alone.
 */
const DETECT_CHUNK_BYTES = 8 * 1024 * 1024;

export default function Setup() {
  const { mode, isReady, features, setRestore } = useWizardMode();
  const [stepId, setStepId] = useState<(typeof STEPS)[number]['id']>('files');
  const [files, setFiles] = useState<WizardFile[]>([]);
  const [forceAll, setForceAll] = useState(false);

  // Auto-detected encryption from the first hashed file; advanced override
  // takes precedence. Falls back to 'GMS' if both are null (the most common
  // MapleRoyals-era client).
  const [detection, setDetection] = useState<DetectionState>({
    status: 'idle',
    version: null,
    mapleVersion: null,
    sourceFile: null,
    error: null,
  });
  const [versionOverride, setVersionOverride] = useState<WzMapleVersionName | null>(null);
  const [runComplete, setRunComplete] = useState(false);

  /** SQLite file the user dropped, kept across the mode switch. */
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  /** Side-channel notice when a mixed drop ignored some files. */
  const [ignoredNotice, setIgnoredNotice] = useState<string | null>(null);
  /**
   * Restore-import state, owned here (not in StepRestore) so the `db.importBytes`
   * call runs exactly once per dropped file even under React 18 StrictMode's
   * dev-time effect double-fire. The handler that sets the file also kicks off
   * the import; StepRestore is presentational.
   */
  const [restoreState, setRestoreState] = useState<RestoreState>({ phase: 'pending' });
  const db = useMemo(() => getDbClient(), []);
  const queryClient = useQueryClient();
  /** Cancellation token: only the latest-dropped file's outcome updates state. */
  const activeRestoreFileRef = useRef<File | null>(null);

  const effectiveVersion: WzMapleVersionName = versionOverride ?? detection.version ?? 'GMS';

  // In-flight guard. A ref (not state) so flipping `detection.status` to
  // 'running' doesn't cause this effect to re-run and cancel its own work
  // via the cleanup — the classic useEffect self-cancel pitfall.
  const detectionInflightRef = useRef(false);

  useEffect(() => {
    // If we have a settled result whose source file is still present, do
    // nothing. If the source file was removed, drop back to idle so the
    // next render picks a new candidate.
    if (
      (detection.status === 'done' || detection.status === 'failed') &&
      detection.sourceFile
    ) {
      const stillThere = files.some((f) => f.file.name === detection.sourceFile);
      if (stillThere) return;
      setDetection({
        status: 'idle',
        version: null,
        mapleVersion: null,
        sourceFile: null,
        error: null,
      });
      return;
    }
    if (detectionInflightRef.current) return;
    if (detection.status === 'running') return;

    const candidate = files.find((f) => f.hashPhase === 'done');
    if (!candidate) return;

    detectionInflightRef.current = true;
    setDetection({
      status: 'running',
      version: null,
      mapleVersion: null,
      sourceFile: candidate.file.name,
      error: null,
    });

    (async () => {
      try {
        const blob = candidate.file.slice(0, DETECT_CHUNK_BYTES);
        const buf = await blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const result = await detectVersion(bytes);
        detectionInflightRef.current = false;
        if (!result) {
          setDetection({
            status: 'failed',
            version: null,
            mapleVersion: null,
            sourceFile: candidate.file.name,
            error: 'no IV produced a confidently-readable directory',
          });
          return;
        }
        setDetection({
          status: 'done',
          version: result.version as WzMapleVersionName,
          mapleVersion: result.mapleVersion,
          sourceFile: candidate.file.name,
          error: null,
        });
      } catch (e) {
        detectionInflightRef.current = false;
        log.warn('version detection threw', describeError(e));
        setDetection({
          status: 'failed',
          version: null,
          mapleVersion: null,
          sourceFile: candidate.file.name,
          error: (e as Error).message ?? 'detection failed',
        });
      }
    })();
  }, [files, detection.status, detection.sourceFile]);

  const onRestoreFile = useCallback(
    (file: File, ignoredOthers: number) => {
      // In update mode with data already loaded, mirror Settings' confirm UX
      // before doing anything destructive. First-run has nothing to replace
      // (counts are all 0), so skip the dialog.
      const hasData =
        features.hasAny || (features.counts?.datasets ?? 0) > 0;
      if (hasData) {
        const sizeMb = (file.size / 1_000_000).toFixed(1);
        const proceed = confirm(
          `Replace the current database with ${file.name} (${sizeMb} MB)?\n\n` +
            `This will discard everything currently in your local database. Your WZ files on disk are untouched.`,
        );
        if (!proceed) return;
      }
      setRestoreFile(file);
      setRestore(true);
      setRestoreState({ phase: 'pending' });
      activeRestoreFileRef.current = file;
      setIgnoredNotice(
        ignoredOthers > 0
          ? `Ignored ${ignoredOthers} other file(s) — restoring from ${file.name} instead.`
          : null,
      );
      // Run the import here (in an event handler, not a useEffect) so it
      // executes exactly once regardless of StrictMode remounts.
      (async () => {
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const result = await db.importBytes(bytes);
          if (activeRestoreFileRef.current !== file) return;
          log.info('restore complete', result);
          setRestoreState({
            phase: 'success',
            backend: result.backend,
            schemaVersion: result.schemaVersion,
          });
          queryClient.invalidateQueries({ queryKey: ['db'] });
        } catch (e) {
          if (activeRestoreFileRef.current !== file) return;
          log.error('restore failed', describeError(e));
          setRestoreState({ phase: 'error', error: e as Error });
        }
      })();
    },
    [features.hasAny, features.counts, setRestore, db, queryClient],
  );

  const onSwitchBackFromRestore = useCallback(() => {
    activeRestoreFileRef.current = null;
    setRestore(false);
    setRestoreFile(null);
    setIgnoredNotice(null);
    setRestoreState({ phase: 'pending' });
  }, [setRestore]);

  const onPickAgainFromRestore = useCallback(() => {
    activeRestoreFileRef.current = null;
    setRestoreFile(null);
    setRestoreState({ phase: 'pending' });
  }, []);

  // Loading skeleton until features have settled.
  if (!isReady || mode === null) {
    return (
      <WizardLayout title="Loading…" steps={[]} currentStepId="">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing your local database…
        </div>
      </WizardLayout>
    );
  }

  // ─── Restore branch ────────────────────────────────────────────────────────
  if (mode === 'restore' && restoreFile) {
    const parentMode: 'first-run' | 'update' = features.isFirstRun ? 'first-run' : 'update';
    return (
      <WizardLayout
        title="Restore from backup"
        subtitle="Load a previously exported database file. This replaces any data currently on this device."
        steps={[]}
        currentStepId=""
        exitSlot={<ExitToApp />}
      >
        {ignoredNotice && (
          <div className="border-border bg-muted/60 text-muted-foreground mb-4 flex items-start gap-2 rounded-md border p-3 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{ignoredNotice}</span>
          </div>
        )}
        <StepRestore
          file={restoreFile}
          state={restoreState}
          parentMode={parentMode}
          onPickAgain={onPickAgainFromRestore}
          onSwitchBack={onSwitchBackFromRestore}
        />
      </WizardLayout>
    );
  }

  // Restore mode but no file yet (user clicked "Drop a different backup").
  // Render a minimal placeholder drop zone that just routes back into the
  // same restore handler.
  if (mode === 'restore' && !restoreFile) {
    return (
      <WizardLayout
        title="Restore from backup"
        subtitle="Drop a database backup file to restore from."
        steps={[]}
        currentStepId=""
        exitSlot={<ExitToApp />}
      >
        <RestoreDropZone onPick={(f) => onRestoreFile(f, 0)} onSwitchBack={onSwitchBackFromRestore} />
      </WizardLayout>
    );
  }

  // ─── First-run / Update branch ─────────────────────────────────────────────
  // All restore + null branches returned above.
  const stepMode: 'first-run' | 'update' = mode === 'restore' ? 'first-run' : mode;

  const filesReady = files.length > 0 && files.every((f) => f.hashPhase === 'done');
  const someIncluded = files.some((f) => f.include);
  const needsManualVersion = detection.status === 'failed' && versionOverride === null;
  const canProceedFromFiles = filesReady && someIncluded && !needsManualVersion;

  const plan = buildPlan(files, { forceAll });
  const planIsRunnable = plan.willRun.length > 0 && plan.missingDeps.length === 0;

  function goPrev() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx > 0) setStepId(STEPS[idx - 1].id);
  }
  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === stepId);
    if (idx < STEPS.length - 1) setStepId(STEPS[idx + 1].id);
  }

  const canStart = canProceedFromFiles && planIsRunnable;

  let body: React.ReactNode;
  if (stepId === 'files')
    body = (
      <>
        {ignoredNotice && (
          <div className="border-border bg-muted/60 text-muted-foreground mb-4 flex items-start gap-2 rounded-md border p-3 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{ignoredNotice}</span>
          </div>
        )}
        <StepFiles
          files={files}
          onChange={setFiles}
          forceAll={forceAll}
          onForceAllChange={setForceAll}
          detection={detection}
          versionOverride={versionOverride}
          onVersionOverrideChange={setVersionOverride}
          mode={stepMode}
          features={features}
          onRestoreFile={onRestoreFile}
        />
      </>
    );
  else
    body = (
      <StepRun
        version={effectiveVersion}
        files={files}
        forceAll={forceAll}
        mode={stepMode}
        onComplete={() => setRunComplete(true)}
      />
    );

  const exitSlot = stepMode === 'update' ? <ExitToApp /> : undefined;

  const footer =
    stepId === 'run' ? (
      runComplete ? (
        <>
          <span />
          <Link
            to="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium"
          >
            Go Explore! <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : stepMode === 'first-run' ? (
        <div className="text-muted-foreground text-xs">
          <Link to="/" className="hover:underline">
            Cancel and return home
          </Link>
        </div>
      ) : (
        <span />
      )
    ) : (
      <>
        {stepId === STEPS[0].id && stepMode === 'update' ? (
          <Link
            to="/"
            className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Exit
          </Link>
        ) : stepId === STEPS[0].id ? (
          <span />
        ) : (
          <Button variant="ghost" size="sm" onClick={goPrev}>
            Back
          </Button>
        )}
        <div className="flex items-center gap-2">
          {stepId === 'files' && !canStart && (
            <span
              className={cn(
                'text-xs',
                needsManualVersion ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {files.length === 0
                ? 'Add at least one file to continue'
                : files.some((f) => f.hashPhase === 'queued' || f.hashPhase === 'hashing')
                  ? 'Reading…'
                  : !someIncluded
                    ? 'Include at least one file'
                    : needsManualVersion
                      ? 'Pick a client variant under Advanced'
                      : plan.missingDeps.length > 0
                        ? 'Add the missing required files'
                        : 'Nothing to load'}
            </span>
          )}
          <Button size="sm" onClick={goNext} disabled={stepId === 'files' && !canStart}>
            {stepId === 'files' ? 'Start' : 'Continue'}
          </Button>
        </div>
      </>
    );

  const title =
    stepMode === 'update' ? 'Manage your wiki' : 'Set up your wiki';
  const subtitle =
    stepMode === 'update'
      ? 'Add files for more categories, refresh existing ones, or drop a backup to restore.'
      : 'Load your game files once. They stay on this device — nothing is uploaded.';

  return (
    <WizardLayout
      title={title}
      subtitle={subtitle}
      steps={STEPS}
      currentStepId={stepId}
      footer={footer}
      exitSlot={exitSlot}
    >
      {body}
    </WizardLayout>
  );
}

function ExitToApp() {
  return (
    <Link
      to="/"
      className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors"
    >
      <ArrowLeft className="h-4 w-4" /> Return to app
    </Link>
  );
}

function RestoreDropZone({
  onPick,
  onSwitchBack,
}: {
  onPick: (file: File) => void;
  onSwitchBack: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(sqlite3?|db)$/i.test(file.name)) {
      alert('That doesn\'t look like a database backup. Pick a .sqlite, .sqlite3, or .db file.');
      return;
    }
    onPick(file);
  };

  return (
    <section className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        className={cn(
          'border-border bg-card flex flex-col items-center justify-center rounded-md border-2 border-dashed py-10 text-center transition-colors',
          dragging && 'border-primary bg-primary/5',
        )}
      >
        <p className="text-sm font-medium">Drop a database backup here</p>
        <p className="text-muted-foreground mt-1 text-xs">
          <code className="font-mono">.sqlite</code>, <code className="font-mono">.sqlite3</code>,
          or <code className="font-mono">.db</code>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          Choose file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".sqlite,.sqlite3,.db,application/vnd.sqlite3"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            accept(f);
          }}
        />
      </div>
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={onSwitchBack}>
          <ArrowLeft className="h-4 w-4" /> Switch back to importing files
        </Button>
      </div>
    </section>
  );
}
