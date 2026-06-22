import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Info, Loader2 } from 'lucide-react';
import { detectVersion, detectImageVersion } from '@scrolled/wz';
import { Button } from '@/components/ui/button';
import { WizardLayout, type WizardStep } from '@/components/wizard/WizardLayout';
import {
  StepFiles,
  type DetectionState,
  type ProfileDetectionState,
  type WizardFile,
} from '@/components/wizard/StepFiles';
import { StepRun } from '@/components/wizard/StepRun';
import { StepWelcome } from '@/components/wizard/StepWelcome';
import { StepRestore, type RestoreState } from '@/components/wizard/StepRestore';
import { buildPlan } from '@/components/wizard/plan';
import { getUserDbClient } from '@/db/user';
import { setActiveServerProfileId } from '@/lib/serverProfileResolution';
import { importBackupBytes } from '@/hooks/useBackup';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';
import { cn } from '@/lib/utils';
import { useWizardMode } from '@/hooks/useWizardMode';
import { usePageTitle } from '@/hooks/usePageTitle';
import { acceptForDesktop } from '@/lib/filePickerAccept';
import { detectServerProfile } from '@scrolled/game-db/serverProfiles';
import { getParserClient, type DataSourceKind, type WzMapleVersionName } from '@/parser';
import { appConfig } from '@/config';

const log = createLogger('setup');

type StepId = 'welcome' | 'files' | 'run';

/** First-run opens on the welcome splash; update mode skips straight to files. */
const FIRST_RUN_STEPS: (WizardStep & { id: StepId })[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'files', label: 'Files' },
  { id: 'run', label: 'Run' },
];
const UPDATE_STEPS: (WizardStep & { id: StepId })[] = [
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

/**
 * Parse String.wz with the singleton parser and run fingerprint detection
 * against it. Returns the detected profile id, or null when nothing matched.
 * Uses the detected/forced client variant so the parser decrypts the strings
 * correctly — a wrong variant yields garbage that won't match a fingerprint.
 */
async function detectProfileFromString(
  stringEntry: WizardFile,
  version: WzMapleVersionName,
  kind: DataSourceKind,
): Promise<string | null> {
  const parser = getParserClient();
  await parser.init(version, kind);
  // WZ: load the single String.wz file. IMG: load every String/*.img by its
  // relative path; the data source exposes them under the same `String.wz/…`
  // logical paths the fingerprint reader walks.
  await parser.load(stringEntry.members.map((m) => ({ name: m.relPath, source: m.file })));
  const profile = await detectServerProfile(async (file, path) => {
    const node = await parser.getNode(`${file}/${path}`);
    return typeof node?.scalar === 'string' ? node.scalar : null;
  });
  return profile?.id ?? null;
}

function datasetKindOf(files: WizardFile[]): DataSourceKind {
  return files[0]?.kind ?? 'wz';
}

/**
 * Pick what to run version detection against, once at least one entry has
 * hashed. WZ slices the head of the `.wz`; IMG reads a small representative
 * `.img` from the gate group (any image decrypts under the same region key,
 * so `Mob.img` is preferred only as a small, reliably-present choice).
 */
function pickDetectCandidate(
  files: WizardFile[],
): { sourceFile: string; readBytes: () => Promise<Uint8Array> } | null {
  const group = files.find((f) => f.hashPhase === 'done');
  if (!group) return null;
  const member =
    group.kind === 'wz'
      ? group.members[0]!
      : (group.members.find((m) => /(^|\/)Mob\.img$/i.test(m.relPath)) ??
        [...group.members].sort((a, b) => a.file.size - b.file.size)[0]!);
  return {
    sourceFile: group.name,
    readBytes: async () =>
      new Uint8Array(await member.file.slice(0, DETECT_CHUNK_BYTES).arrayBuffer()),
  };
}

export default function SetupRoute() {
  // The fixed-dataset deployment has no import flow, so the wizard is
  // unreachable — a direct URL visit bounces home.
  if (!appConfig.features.enableUserImport) return <Navigate to="/" replace />;
  return <SetupWizard />;
}

function SetupWizard() {
  usePageTitle('Setup');
  const { mode, isReady, features, setRestore } = useWizardMode();
  const location = useLocation();
  // Set when the user was bounced here because their stored library is too old
  // for this build to read (see AppShell#useSetupRedirect).
  const incompatibleLibrary =
    (location.state as { reason?: string } | null)?.reason === 'data-incompatible';
  const [stepId, setStepId] = useState<StepId>('welcome');
  // Format the user committed to on the welcome step. Null until chosen (and
  // stays null in update mode, where the files step auto-detects either).
  const [source, setSource] = useState<DataSourceKind | null>(null);
  const [files, setFiles] = useState<WizardFile[]>([]);

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

  // Server-profile auto-detection from String.wz fingerprints. Runs after the
  // client variant settles (the parser needs it to decrypt strings correctly),
  // and re-runs if that variant changes. Advanced override takes precedence.
  const [profileDetection, setProfileDetection] = useState<ProfileDetectionState>({
    status: 'idle',
    profileId: null,
    sourceVersion: null,
    error: null,
  });
  const [profileOverride, setProfileOverride] = useState<string | null>(null);
  const profileDetectionInflightRef = useRef(false);

  /** SQLite file the user dropped, kept across the mode switch. */
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  /** Side-channel notice when a mixed drop ignored some files. */
  const [ignoredNotice, setIgnoredNotice] = useState<string | null>(null);
  /**
   * Restore-import state, owned here (not in StepRestore) so the
   * `importBackupBytes` call runs exactly once per dropped file even under
   * React 18 StrictMode's dev-time effect double-fire. The handler that sets
   * the file also kicks off the import; StepRestore is presentational.
   */
  const [restoreState, setRestoreState] = useState<RestoreState>({ phase: 'pending' });
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
    if ((detection.status === 'done' || detection.status === 'failed') && detection.sourceFile) {
      const stillThere = files.some((f) => f.name === detection.sourceFile);
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

    const candidate = pickDetectCandidate(files);
    if (!candidate) return;
    const kind = datasetKindOf(files);
    const sourceFile = candidate.sourceFile;

    detectionInflightRef.current = true;
    setDetection({
      status: 'running',
      version: null,
      mapleVersion: null,
      sourceFile,
      error: null,
    });

    (async () => {
      try {
        const bytes = await candidate.readBytes();
        // IMG has no PKG1 header / patch version; detect the region key only.
        const result =
          kind === 'img'
            ? await detectImageVersion(bytes)
            : await detectVersion(bytes);
        detectionInflightRef.current = false;
        if (!result) {
          setDetection({
            status: 'failed',
            version: null,
            mapleVersion: null,
            sourceFile,
            error: 'no IV produced a confidently-readable result',
          });
          return;
        }
        setDetection({
          status: 'done',
          version: result.version as WzMapleVersionName,
          mapleVersion: (result as { mapleVersion?: number }).mapleVersion ?? null,
          sourceFile,
          error: null,
        });
      } catch (e) {
        detectionInflightRef.current = false;
        log.warn('version detection threw', describeError(e));
        setDetection({
          status: 'failed',
          version: null,
          mapleVersion: null,
          sourceFile,
          error: (e as Error).message ?? 'detection failed',
        });
      }
    })();
  }, [files, detection.status, detection.sourceFile]);

  // Profile detection. Mirrors the version-detection state machine: a settled
  // result is kept while String.wz is still present and the variant it ran
  // under is unchanged; otherwise it drops back to idle and re-detects.
  useEffect(() => {
    const stringFile = files.find((f) => f.name === 'String.wz' && f.hashPhase === 'done');
    const versionSettled = detection.status === 'done' || detection.status === 'failed';

    if (profileDetection.status === 'done' || profileDetection.status === 'failed') {
      const stillValid = !!stringFile && profileDetection.sourceVersion === effectiveVersion;
      if (stillValid) return;
      setProfileDetection({ status: 'idle', profileId: null, sourceVersion: null, error: null });
      return;
    }
    if (profileDetectionInflightRef.current) return;
    if (profileDetection.status === 'running') return;
    if (!stringFile || !versionSettled) return;

    profileDetectionInflightRef.current = true;
    const usedVersion = effectiveVersion;
    setProfileDetection({
      status: 'running',
      profileId: null,
      sourceVersion: usedVersion,
      error: null,
    });

    (async () => {
      try {
        const profileId = await detectProfileFromString(
          stringFile,
          usedVersion,
          datasetKindOf(files),
        );
        profileDetectionInflightRef.current = false;
        setProfileDetection({
          status: 'done',
          profileId,
          sourceVersion: usedVersion,
          error: null,
        });
      } catch (e) {
        profileDetectionInflightRef.current = false;
        log.warn('server profile detection threw', describeError(e));
        setProfileDetection({
          status: 'failed',
          profileId: null,
          sourceVersion: usedVersion,
          error: (e as Error).message ?? 'detection failed',
        });
      }
    })();
  }, [
    files,
    detection.status,
    effectiveVersion,
    profileDetection.status,
    profileDetection.sourceVersion,
  ]);

  const onRestoreFile = useCallback(
    (file: File, ignoredOthers: number) => {
      // In update mode with data already loaded, mirror Settings' confirm UX
      // before doing anything destructive. First-run has nothing to replace
      // (counts are all 0), so skip the dialog.
      const hasData = features.hasAny || (features.counts?.datasets ?? 0) > 0;
      if (hasData) {
        const sizeMb = (file.size / 1_000_000).toFixed(1);
        const proceed = confirm(
          `Replace the current database with ${file.name} (${sizeMb} MB)?\n\n` +
            `This will discard everything currently in your local library. Your game files on disk are untouched.`,
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
          const result = await importBackupBytes(bytes);
          if (activeRestoreFileRef.current !== file) return;
          log.info('restore complete', result);
          setRestoreState({
            phase: 'success',
            backend: result.backend ?? 'opfs',
            schemaVersion: result.schemaVersion ?? 0,
            imported: result.imported,
            warnings: result.warnings,
          });
          queryClient.invalidateQueries({ queryKey: ['db'] });
          queryClient.invalidateQueries({ queryKey: ['user', 'collections'] });
        } catch (e) {
          if (activeRestoreFileRef.current !== file) return;
          log.error('restore failed', describeError(e));
          setRestoreState({ phase: 'error', error: e as Error });
        }
      })();
    },
    [features.hasAny, features.counts, setRestore, queryClient],
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
        <RestoreDropZone
          onPick={(f) => onRestoreFile(f, 0)}
          onSwitchBack={onSwitchBackFromRestore}
        />
      </WizardLayout>
    );
  }

  // ─── First-run / Update branch ─────────────────────────────────────────────
  // All restore + null branches returned above.
  const stepMode: 'first-run' | 'update' = mode === 'restore' ? 'first-run' : mode;
  const STEPS = stepMode === 'first-run' ? FIRST_RUN_STEPS : UPDATE_STEPS;
  // Update mode has no welcome step; coerce the initial 'welcome' state to the
  // first real step so navigation indexing stays in sync with STEPS.
  const step: StepId = stepMode === 'update' && stepId === 'welcome' ? 'files' : stepId;

  const filesReady = files.length > 0 && files.every((f) => f.hashPhase === 'done');
  const someIncluded = files.some((f) => f.include);
  const needsManualVersion = detection.status === 'failed' && versionOverride === null;
  const canProceedFromFiles = filesReady && someIncluded && !needsManualVersion;

  const plan = buildPlan(files);
  const planIsRunnable = plan.willRun.length > 0 && plan.missingDeps.length === 0;

  function chooseSource(kind: DataSourceKind) {
    // Switching format mid-setup invalidates whatever was already dropped.
    if (source !== kind) setFiles([]);
    setSource(kind);
    setStepId('files');
  }

  function goPrev() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx > 0) setStepId(STEPS[idx - 1].id);
  }
  function goNext() {
    const idx = STEPS.findIndex((s) => s.id === step);
    if (idx < STEPS.length - 1) setStepId(STEPS[idx + 1].id);
  }

  const canStart = canProceedFromFiles && planIsRunnable;

  let body: React.ReactNode;
  if (step === 'welcome')
    body = <StepWelcome onChoose={chooseSource} onRestore={() => setRestore(true)} />;
  else if (step === 'files')
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
          detection={detection}
          versionOverride={versionOverride}
          onVersionOverrideChange={setVersionOverride}
          profileDetection={profileDetection}
          profileOverride={profileOverride}
          onProfileOverrideChange={setProfileOverride}
          mode={stepMode}
          source={source}
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
        mode={stepMode}
        onComplete={() => {
          setRunComplete(true);
          // Persist the chosen profile only when one was explicitly picked or
          // detected. Leaving it null preserves any existing selection, so a
          // re-run without String.wz doesn't reset the user back to Classic.
          const profileId = profileOverride ?? profileDetection.profileId;
          if (profileId) {
            setActiveServerProfileId(getUserDbClient(), profileId)
              .then(() => queryClient.invalidateQueries({ queryKey: ['db', 'server-profile'] }))
              .catch((e) => log.warn('failed to persist server profile', describeError(e)));
          }
        }}
      />
    );

  const exitSlot = stepMode === 'update' ? <ExitToApp /> : undefined;

  // The welcome splash carries its own choice buttons, so it needs no footer.
  const footer =
    step === 'welcome' ? undefined : step === 'run' ? (
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
        {step === STEPS[0].id && stepMode === 'update' ? (
          <Link
            to="/"
            className="hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Exit
          </Link>
        ) : step === STEPS[0].id ? (
          <span />
        ) : (
          <Button variant="ghost" size="sm" onClick={goPrev}>
            Back
          </Button>
        )}
        <div className="flex items-center gap-2">
          {step === 'files' && !canStart && (
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
          <Button size="sm" onClick={goNext} disabled={step === 'files' && !canStart}>
            {step === 'files' ? 'Start' : 'Continue'}
          </Button>
        </div>
      </>
    );

  let title: string;
  let subtitle: string | undefined;
  if (stepMode === 'update') {
    title = 'Manage your wiki';
    subtitle = 'Add files for more categories, refresh existing ones, or drop a backup to restore.';
  } else if (step === 'welcome') {
    title = 'Welcome to Scrolled';
    subtitle = undefined;
  } else {
    title = 'Set up your wiki';
    subtitle = 'Load your game files to build your personal wiki.';
  }

  return (
    <WizardLayout
      title={title}
      subtitle={subtitle}
      steps={STEPS}
      currentStepId={step}
      footer={footer}
      exitSlot={exitSlot}
    >
      {incompatibleLibrary && (
        <div className="text-foreground mb-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium">Your library needs to be rebuilt</p>
            <p className="text-muted-foreground mt-1">
              This version of the app changed how your library is stored, so the data already on
              this device can't be read. Load your game files below to rebuild it, or restore a
              recent backup.
            </p>
          </div>
        </div>
      )}
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
    if (!/\.scrolled-backup$/i.test(file.name) && !/\.(sqlite3?|db)$/i.test(file.name)) {
      alert(
        "That doesn't look like a backup. Pick a .scrolled-backup file (or a legacy .sqlite export).",
      );
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
        <p className="text-sm font-medium">Drop a backup here</p>
        <p className="text-muted-foreground mt-1 text-xs">
          a <code className="font-mono">.scrolled-backup</code> file, or a legacy{' '}
          <code className="font-mono">.sqlite</code> / <code className="font-mono">.db</code> export
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
          accept={acceptForDesktop('.scrolled-backup,.sqlite,.sqlite3,.db,application/gzip')}
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
