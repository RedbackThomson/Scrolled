import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  FolderOpen,
  Info,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@scrolled/ui';
import { getDbClient } from '@/db';
import { sha256OfFile } from '@/lib/hashFile';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';
import type { Features } from '@/hooks/useFeatures';
import { cn } from '@scrolled/ui';
import { acceptForDesktop } from '@/lib/filePickerAccept';
import type { DataSourceKind, WzMapleVersionName } from '@/parser';
import { BUILTIN_PROFILES } from '@scrolled/game-db/serverProfiles';
import {
  asRelFiles,
  datasetKind,
  gatherDropEntries,
  normalizeImgRelPath,
  splitByKind,
  type RelFile,
} from './dropClassify';
import { EntityStatus } from './EntityStatus';

const log = createLogger('wizard-files');

const HEAVY_FILES = new Set(['Map.wz', 'Character.wz', 'Sound.wz', 'Effect.wz']);

export type HashPhase = 'queued' | 'hashing' | 'done' | 'error';

/** One underlying file plus its path relative to the dropped folder. */
export interface WizardMember {
  relPath: string;
  file: File;
}

/**
 * A display/plan unit. For a WZ drop this is one `.wz` file. For an IMG drop
 * this is one top-level folder (e.g. `Item/`), surfaced under the logical name
 * `Item.wz` so the plan and entity-status UI light up the same rows as WZ —
 * its `members` are every `.img` beneath that folder.
 */
export interface WizardFile {
  /** Logical name: WZ file name, or `<Folder>.wz` for an IMG group. */
  name: string;
  /** Total bytes across `members`. */
  size: number;
  kind: DataSourceKind;
  members: WizardMember[];
  /** Lowercase SHA-256 of the file's bytes (WZ only). Always null for IMG. */
  hash: string | null;
  hashPhase: HashPhase;
  hashError: string | null;
  /** User decision: include this entry in extraction. */
  include: boolean;
  /** Existing dataset_files row this hash matches, if any. */
  matchedExisting: { name: string } | null;
}

export interface DetectionState {
  status: 'idle' | 'running' | 'done' | 'failed';
  version: WzMapleVersionName | null;
  mapleVersion: number | null;
  sourceFile: string | null;
  error: string | null;
}

export interface ProfileDetectionState {
  status: 'idle' | 'running' | 'done' | 'failed';
  /** Detected profile id, or null when nothing matched. */
  profileId: string | null;
  /** Client variant the scan ran under; lets the parent re-detect on change. */
  sourceVersion: WzMapleVersionName | null;
  error: string | null;
}

interface Props {
  files: WizardFile[];
  onChange: React.Dispatch<React.SetStateAction<WizardFile[]>>;
  /** Encryption-version auto-detection state from the parent wizard. */
  detection: DetectionState;
  /** Manual override; `null` means "trust the auto-detected version." */
  versionOverride: WzMapleVersionName | null;
  onVersionOverrideChange: (v: WzMapleVersionName | null) => void;
  /** Server-profile auto-detection state from the parent wizard. */
  profileDetection: ProfileDetectionState;
  /** Manual profile override; `null` means "trust auto-detection." */
  profileOverride: string | null;
  onProfileOverrideChange: (v: string | null) => void;
  /** Wizard mode — drives entity-status copy. */
  mode: 'first-run' | 'update';
  /**
   * Format the user chose on the welcome step. Constrains the drop zone's
   * instructions and accepted files. `null` (update mode) accepts either
   * format and auto-detects, the long-standing behaviour.
   */
  source: DataSourceKind | null;
  features: Features;
  /**
   * Called when the user drops a backup file (`.scrolled-backup`, or a legacy
   * `.sqlite`/`.db`). The parent owns the confirm-before-replace dialog and the
   * actual mode switch.
   */
  onRestoreFile: (file: File, ignoredOthers: number) => void;
}

/** Drop-zone copy and accepted extensions, keyed by the chosen source format
 *  (`'any'` is update mode, where either format is welcome). */
const DROP_COPY: Record<
  'wz' | 'img' | 'any',
  { heading: string; body: React.ReactNode; dropTitle: string; dropHint: React.ReactNode; accept: string }
> = {
  wz: {
    heading: 'Add your .wz files',
    body: (
      <>
        Open your game's installation folder, select every{' '}
        <code className="font-mono text-xs">.wz</code> file, and drop them here. Everything stays on
        this device.
      </>
    ),
    dropTitle: 'Drag and drop your .wz files here',
    dropHint: (
      <>
        the <code className="font-mono">.wz</code> files from your game folder
      </>
    ),
    accept: '.wz',
  },
  img: {
    heading: 'Add your Data folder',
    body: (
      <>
        Open your game's installation folder and drop the whole{' '}
        <code className="font-mono text-xs">Data</code> folder here — that's where the extracted{' '}
        <code className="font-mono text-xs">.img</code> files live. Everything stays on this device.
      </>
    ),
    dropTitle: 'Drag and drop your Data folder here',
    dropHint: (
      <>
        the <code className="font-mono">Data</code> folder of <code className="font-mono">.img</code>{' '}
        files
      </>
    ),
    accept: '.img',
  },
  any: {
    heading: 'Add your files',
    body: (
      <>
        Drop your <code className="font-mono text-xs">.wz</code> files, or choose a folder of
        extracted <code className="font-mono text-xs">.img</code> files. You can also drop a{' '}
        <code className="font-mono text-xs">.scrolled-backup</code> file to restore a previously
        exported wiki. Everything stays on this device.
      </>
    ),
    dropTitle: 'Drag and drop files or a folder here',
    dropHint: (
      <>
        <code className="font-mono">.wz</code> game files, an{' '}
        <code className="font-mono">.img</code> folder, or a{' '}
        <code className="font-mono">.scrolled-backup</code> file
      </>
    ),
    accept: '.wz,.img,.scrolled-backup,.sqlite,.sqlite3,.db,application/gzip',
  },
};

const VERSION_OPTIONS: { id: WzMapleVersionName; label: string }[] = [
  { id: 'GMS', label: 'GMS · older global-region client' },
  { id: 'BMS', label: 'BMS · modern client (alternate IV)' },
  { id: 'EMS', label: 'EMS · older European client' },
  { id: 'CLASSIC', label: 'Classic · uncommon, zero-IV variant' },
];

function topFolder(relPath: string): string {
  return relPath.split('/')[0] ?? relPath;
}

function folderToLogical(folder: string): string {
  return /\.wz$/i.test(folder) ? folder : `${folder}.wz`;
}

/** Regroup a flat list of `.img` members into per-top-folder WizardFiles.
 *
 * IMG groups are marked `'done'` (no hash) immediately: an `.img` folder can
 * hold tens of thousands of files, and content/manifest hashing them on the
 * main thread froze the wizard for minutes for a "have I seen this folder
 * before?" badge that's marginal at best. WZ archives still hash (whole-file
 * dedup via the worker); the dataset record just carries no hash for IMG. */
function groupImgMembers(members: WizardMember[]): WizardFile[] {
  const byFolder = new Map<string, WizardMember[]>();
  const seen = new Set<string>();
  for (const m of members) {
    if (seen.has(m.relPath)) continue;
    seen.add(m.relPath);
    const logical = folderToLogical(topFolder(m.relPath));
    const list = byFolder.get(logical) ?? [];
    list.push(m);
    byFolder.set(logical, list);
  }
  return [...byFolder.entries()].map(([name, mem]) => ({
    name,
    size: mem.reduce((n, m) => n + m.file.size, 0),
    kind: 'img' as const,
    members: mem,
    hash: null,
    hashPhase: 'done' as const,
    hashError: null,
    include: true,
    matchedExisting: null,
  }));
}

export function StepFiles({
  files,
  onChange,
  detection,
  versionOverride,
  onVersionOverrideChange,
  profileDetection,
  profileOverride,
  onProfileOverrideChange,
  mode,
  source,
  features,
  onRestoreFile,
}: Props) {
  const db = useMemo(() => getDbClient(), []);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  /** Hash jobs we've already started, keyed by `name:size` so a changed drop
   *  re-triggers but a re-render doesn't. */
  const startedHashing = useRef<Set<string>>(new Set());

  const existingNames = useQuery({
    queryKey: ['db', 'loaded-files'],
    queryFn: () => db.listLoadedFileNames(),
  });

  const addFiles = useCallback(
    (incoming: RelFile[]) => {
      const split = splitByKind(incoming);
      if (split.backup.length > 0) {
        // A backup drop wins. Restore is destructive and explicit; mixing in
        // fresh-import would be ambiguous.
        const ignored =
          split.wz.length + split.img.length + split.other.length + (split.backup.length - 1);
        onRestoreFile(split.backup[0]!, ignored);
        return;
      }
      for (const f of split.other) log.warn('ignoring unknown file', { name: f.name });

      const dk = datasetKind(split);
      if (dk === 'none') return;
      if (dk === 'mixed') {
        setNotice('Add either .wz files or a folder of .img files — not both at once.');
        return;
      }
      // The welcome step already committed to a format; reject the other one
      // with a pointer back rather than silently switching modes.
      if (source && dk !== source) {
        setNotice(
          source === 'wz'
            ? 'These look like extracted .img files. Go back and choose the Data-folder option, or drop your .wz files here.'
            : 'These look like .wz files. Go back and choose the .wz option, or drop your Data folder here.',
        );
        return;
      }
      const currentKind = files[0]?.kind ?? null;
      if (currentKind && currentKind !== dk) {
        setNotice(
          `This library is being built from ${currentKind === 'wz' ? '.wz files' : 'an .img folder'}. Remove them first to switch formats.`,
        );
        return;
      }
      setNotice(null);

      if (dk === 'wz') {
        const incomingFiles: WizardFile[] = [];
        for (const f of split.wz) {
          const dup = files.some((x) => x.name === f.name && x.size === f.size);
          if (dup) continue;
          incomingFiles.push({
            name: f.name,
            size: f.size,
            kind: 'wz',
            members: [{ relPath: f.name, file: f }],
            hash: null,
            hashPhase: 'queued',
            hashError: null,
            include: true,
            matchedExisting: null,
          });
        }
        if (incomingFiles.length === 0) return;
        onChange((prev) => [...prev, ...incomingFiles]);
        return;
      }

      // IMG: union existing members with the incoming ones and regroup, so a
      // second folder pick merges cleanly. `include` is preserved per folder.
      const existingInclude = new Map(files.map((f) => [f.name, f.include]));
      const incomingMembers = split.img.map((rf) => ({
        relPath: normalizeImgRelPath(rf.relPath),
        file: rf.file,
      }));
      const allMembers = [...files.flatMap((f) => f.members), ...incomingMembers];
      const regrouped = groupImgMembers(allMembers).map((g) => ({
        ...g,
        include: existingInclude.get(g.name) ?? true,
      }));
      onChange(() => regrouped);
    },
    [files, onChange, onRestoreFile, source],
  );

  // Hash newly added WZ archives (whole-file dedup) one budget's worth at a
  // time. IMG groups are added already `'done'`, so they never appear here.
  useEffect(() => {
    const toStart = files.filter((f) => {
      const key = `${f.name}:${f.size}`;
      return f.hashPhase === 'queued' && !startedHashing.current.has(key);
    });
    if (toStart.length === 0) return;

    for (const wf of toStart) {
      const key = `${wf.name}:${wf.size}`;
      startedHashing.current.add(key);
      const patch = (updates: Partial<WizardFile>) => {
        onChange((prev) => prev.map((f) => (f.name === wf.name ? { ...f, ...updates } : f)));
      };

      sha256OfFile(wf.members[0]!.file, { onStarted: () => patch({ hashPhase: 'hashing' }) })
        .then(async (hash) => {
          let matched: WizardFile['matchedExisting'] = null;
          try {
            const found = await db.findFileByHash(hash);
            if (found) matched = { name: found.name };
          } catch (e) {
            log.warn('findFileByHash failed', describeError(e));
          }
          patch({ hashPhase: 'done', hash, matchedExisting: matched });
        })
        .catch((e) => {
          log.error('hashing failed', describeError(e));
          patch({ hashPhase: 'error', hashError: (e as Error).message ?? 'failed to read' });
        });
    }
  }, [files, db, onChange]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    void gatherDropEntries(e.dataTransfer).then((rel) => {
      if (rel.length > 0) addFiles(rel);
    });
  }

  function remove(file: WizardFile) {
    onChange(files.filter((f) => f !== file));
  }

  function toggle(file: WizardFile, value: boolean) {
    onChange(files.map((f) => (f === file ? { ...f, include: value } : f)));
  }

  const copy = DROP_COPY[source ?? 'any'];

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{copy.heading}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{copy.body}</p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'border-border bg-card flex flex-col items-center justify-center rounded-md border-2 border-dashed py-10 text-center transition-colors',
            dragging && 'border-primary bg-primary/5',
          )}
        >
          {source === 'img' ? (
            <FolderOpen className="text-muted-foreground mb-3 h-8 w-8" />
          ) : (
            <Upload className="text-muted-foreground mb-3 h-8 w-8" />
          )}
          <p className="text-sm font-medium">{copy.dropTitle}</p>
          <p className="text-muted-foreground mt-1 text-xs">{copy.dropHint}</p>
          <div className="mt-3 flex gap-2">
            {source !== 'img' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
              >
                Choose files
              </Button>
            )}
            {source !== 'wz' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => dirInputRef.current?.click()}
              >
                <FolderOpen className="h-4 w-4" /> Choose folder
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={acceptForDesktop(copy.accept)}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(asRelFiles(e.target.files));
              e.target.value = '';
            }}
          />
          <input
            ref={dirInputRef}
            type="file"
            multiple
            className="hidden"
            // `webkitdirectory` isn't in React's input prop types.
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={(e) => {
              if (e.target.files) addFiles(asRelFiles(e.target.files));
              e.target.value = '';
            }}
          />
        </div>

        {notice && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <details className="border-border bg-card group rounded-md border text-sm">
          <summary className="text-muted-foreground flex cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-xs">
            <span className="font-medium uppercase tracking-wide">
              Dropped files · {files.length}
            </span>
            <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide">
              details
            </span>
          </summary>
          <ul className="divide-border divide-y border-t">
            {files.map((f) => (
              <li key={f.name} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <label className="text-muted-foreground flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={f.include}
                      onChange={(e) => toggle(f, e.target.checked)}
                      className="accent-primary h-3.5 w-3.5"
                      disabled={f.hashPhase === 'queued' || f.hashPhase === 'hashing'}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{f.name}</span>
                      {f.kind === 'img' && (
                        <span className="text-muted-foreground text-[10px]">
                          {f.members.length.toLocaleString()} .img files
                        </span>
                      )}
                      {HEAVY_FILES.has(f.name) && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          <FileWarning className="h-3 w-3" /> large file
                        </span>
                      )}
                      {existingNames.data?.includes(f.name) && !f.matchedExisting && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          updating
                        </span>
                      )}
                      {f.matchedExisting && (
                        <span className="inline-flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3" /> already loaded
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {(f.size / 1_000_000).toFixed(1)} MB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(f)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    aria-label={`Remove ${f.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {(f.hashPhase === 'queued' || f.hashPhase === 'hashing') && (
                  <p className="text-muted-foreground inline-flex items-center gap-1.5 pl-7 text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {f.hashPhase === 'queued' ? 'Queued…' : 'Reading…'}
                  </p>
                )}
                {f.hashPhase === 'error' && f.hashError && (
                  <p className="text-destructive inline-flex items-center gap-1.5 pl-7 text-xs">
                    <AlertTriangle className="h-3 w-3" /> {f.hashError}
                  </p>
                )}
                {f.hash && (
                  <details className="text-muted-foreground/70 pl-7 text-[11px]">
                    <summary className="cursor-pointer">Technical details</summary>
                    <div className="mt-1 font-mono">sha256: {f.hash}</div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </details>

        <EntityStatus files={files} features={features} mode={mode} />

        {files.length > 0 && (
          <>
            <GameVersionAdvancedPanel
              detection={detection}
              versionOverride={versionOverride}
              onVersionOverrideChange={onVersionOverrideChange}
            />
            <ProfileAdvancedPanel
              detection={profileDetection}
              override={profileOverride}
              onOverrideChange={onProfileOverrideChange}
            />
          </>
        )}
      </div>
    </section>
  );
}

function GameVersionAdvancedPanel({
  detection,
  versionOverride,
  onVersionOverrideChange,
}: {
  detection: DetectionState;
  versionOverride: WzMapleVersionName | null;
  onVersionOverrideChange: (v: WzMapleVersionName | null) => void;
}) {
  const detected = detection.version;
  const summary =
    detection.status === 'running'
      ? 'Detecting client variant…'
      : detection.status === 'done' && detected
        ? `Detected client variant: ${detected}${detection.mapleVersion ? ` · v${detection.mapleVersion}` : ''}`
        : detection.status === 'failed'
          ? 'Could not auto-detect client variant — defaulting to GMS. Pick one below if names look wrong.'
          : 'Client variant will be detected from your files automatically';

  const Icon =
    detection.status === 'running'
      ? Loader2
      : detection.status === 'done'
        ? CheckCircle2
        : detection.status === 'failed'
          ? AlertTriangle
          : Info;

  return (
    <details className="border-border bg-card group rounded-md border text-xs">
      <summary className="text-muted-foreground flex cursor-pointer items-center gap-2 px-3 py-2">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            detection.status === 'running' && 'animate-spin',
            detection.status === 'done' && 'text-green-600 dark:text-green-400',
            detection.status === 'failed' && 'text-amber-600 dark:text-amber-400',
          )}
        />
        <span className="flex-1">{summary}</span>
        {versionOverride && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            override: {versionOverride}
          </span>
        )}
        <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide group-open:hidden">
          advanced
        </span>
      </summary>
      <div className="border-border border-t px-3 py-2.5">
        <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
          We automatically detect which game-client variant your files come from. Override this only
          if names render as garbage in the wiki.
        </p>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground shrink-0">Force variant:</span>
          <select
            value={versionOverride ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onVersionOverrideChange(v === '' ? null : (v as WzMapleVersionName));
            }}
            className="border-border bg-background rounded border px-2 py-1 text-xs"
          >
            <option value="">Auto ({detected ?? 'GMS fallback'})</option>
            {VERSION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}

function nameForProfile(id: string | null): string | null {
  if (!id) return null;
  return BUILTIN_PROFILES.find((p) => p.id === id)?.name ?? id;
}

function ProfileAdvancedPanel({
  detection,
  override,
  onOverrideChange,
}: {
  detection: ProfileDetectionState;
  override: string | null;
  onOverrideChange: (v: string | null) => void;
}) {
  const detectedName = nameForProfile(detection.profileId);
  const overrideName = nameForProfile(override);
  // "Ran but matched nothing" and "couldn't read the files" both warn and fall
  // back to Classic — surfaced in amber so the user knows to pick one.
  const notDetected = detection.status === 'done' && detection.profileId === null;
  const couldNotRead = detection.status === 'failed';

  const summary =
    detection.status === 'running'
      ? 'Detecting server profile…'
      : detection.status === 'done' && detectedName
        ? `Detected server profile: ${detectedName}`
        : notDetected
          ? 'No server profile detected — defaulting to Classic. Pick one below if you know your server.'
          : couldNotRead
            ? "Couldn't read your files to detect a server profile — defaulting to Classic. Pick one below."
            : 'Server profile will be detected from your files automatically';

  const Icon =
    detection.status === 'running'
      ? Loader2
      : detection.status === 'done' && detectedName
        ? CheckCircle2
        : notDetected || couldNotRead
          ? AlertTriangle
          : Info;

  return (
    <details className="border-border bg-card group rounded-md border text-xs">
      <summary className="text-muted-foreground flex cursor-pointer items-center gap-2 px-3 py-2">
        <Icon
          className={cn(
            'h-3.5 w-3.5 shrink-0',
            detection.status === 'running' && 'animate-spin',
            detection.status === 'done' && detectedName && 'text-green-600 dark:text-green-400',
            (notDetected || couldNotRead) && 'text-amber-600 dark:text-amber-400',
          )}
        />
        <span className="flex-1">{summary}</span>
        {overrideName && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
            override: {overrideName}
          </span>
        )}
        <span className="text-muted-foreground/70 text-[10px] uppercase tracking-wide group-open:hidden">
          advanced
        </span>
      </summary>
      <div className="border-border border-t px-3 py-2.5">
        <p className="text-muted-foreground mb-2 text-[11px] leading-relaxed">
          We try to detect which server your files come from and tailor parts of the experience to
          it. Override this if the detected profile is wrong, or to pick one yourself.
        </p>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground shrink-0">Force profile:</span>
          <select
            value={override ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onOverrideChange(v === '' ? null : v);
            }}
            className="border-border bg-background rounded border px-2 py-1 text-xs"
          >
            <option value="">Auto ({detectedName ?? 'Classic fallback'})</option>
            {BUILTIN_PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}
