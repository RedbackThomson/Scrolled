import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { proxy } from 'comlink';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { getParserClient } from '@/parser';
import type { WzMapleVersionName } from '@/parser';
import type { ProgressUpdate } from '@/lib/progress';
import { useExtractAll } from '@/lib/useExtractAll';
import { createLogger, describeError } from '@/lib/logger';
import { buildPlan } from './plan';
import type { WizardFile } from './StepFiles';

const log = createLogger('wizard-run');

interface Props {
  version: WzMapleVersionName;
  files: WizardFile[];
  onComplete: () => void;
}

/**
 * Runs the wizard's extraction:
 *
 *   1. Initialize the parser worker with the chosen WZ version.
 *   2. Load **every** dropped WZ file into the parser worker — including
 *      hash-matched ones. Cross-referencing extractors (e.g. quests
 *      reading names from String.wz) need their companion files in worker
 *      memory even when we're not re-extracting them. Hash-skipping is
 *      enforced at the extractor layer, not at load time.
 *   3. Trigger the extract → persist pipeline via `useExtractAll`. The
 *      plan's `skipWz` short-circuits extractors whose primary file
 *      either wasn't dropped or was dropped hash-matched without
 *      force-reprocess.
 *   4. Record the run as a new `datasets` row with each file's hash.
 */
export function StepRun({ version, files, onComplete }: Props) {
  const parser = useMemo(() => getParserClient(), []);
  const [loadProgress, setLoadProgress] = useState<ProgressUpdate | null>(null);
  const [loadDone, setLoadDone] = useState(false);
  const [loadErrors, setLoadErrors] = useState<{ name: string; message: string }[]>([]);

  const plan = useMemo(() => buildPlan(files), [files]);
  const { filesToLoad, skipWz, recordFiles } = plan;

  // -- Step 1+2: init + load WZ files --
  const loadM = useMutation({
    mutationFn: async () => {
      setLoadProgress({ phase: 'Initializing parser', current: 0 });
      await parser.init(version);
      if (filesToLoad.length === 0) {
        log.info('no files to load');
        return;
      }
      const onLoadProgress = proxy((p: ProgressUpdate) => setLoadProgress(p));
      // Load every dropped file — including hash-matched ones — so the
      // parser worker has the data extractors will cross-reference (e.g.
      // String.wz for quest names). Skipping happens at the extractor
      // layer via `skipWz`, not at load time.
      const result = await parser.load(
        filesToLoad.map((f) => ({ name: f.file.name, source: f.file })),
        onLoadProgress,
      );
      if (result.errors.length > 0) {
        log.warn('parser.load returned per-file errors', { errors: result.errors });
        setLoadErrors(result.errors);
      }
    },
    onSuccess: () => {
      setLoadProgress(null);
      setLoadDone(true);
    },
    onError: (e) => {
      log.error('load failed', describeError(e));
      setLoadProgress(null);
    },
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    loadM.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -- Step 3+4: extract + record dataset --
  const extract = useExtractAll({
    skipWz,
    recordFiles,
    wzVersion: version,
    label: `${version} · ${new Date().toLocaleDateString()}`,
    loadErrors,
  });
  const extractStartedRef = useRef(false);
  useEffect(() => {
    if (!loadDone) return;
    if (extractStartedRef.current) return;
    extractStartedRef.current = true;
    extract.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDone]);

  // Fire onComplete once we have stats.
  const completedRef = useRef(false);
  useEffect(() => {
    if (extract.stats && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [extract.stats, onComplete]);

  const error = loadM.error ?? extract.error;
  if (error) {
    return (
      <section className="space-y-4">
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4">
          <h3 className="font-semibold">Extraction failed</h3>
          <p className="mt-1 text-sm">{(error as Error).message}</p>
        </div>
        <p className="text-muted-foreground text-sm">
          You can fix the issue and try again. Diagnostics on{' '}
          <Link to="/debug" className="text-primary hover:underline">
            /debug
          </Link>{' '}
          have the full error chain.
        </p>
      </section>
    );
  }

  if (extract.stats) {
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          <div>
            <h2 className="text-lg font-semibold">Setup complete</h2>
            <p className="text-muted-foreground text-sm">
              Loaded {extract.stats.items} items, {extract.stats.equips} equips,{' '}
              {extract.stats.mobs} mobs, {extract.stats.npcs} NPCs, {extract.stats.maps} maps,{' '}
              {extract.stats.quests} quests in {(extract.stats.ms / 1000).toFixed(1)}s.
              {extract.stats.skipped > 0 && (
                <> {extract.stats.skipped} skipped (no localized name).</>
              )}
            </p>
          </div>
        </div>
        {loadErrors.length > 0 && (
          <div className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-md border p-4">
            <h3 className="text-sm font-semibold">
              Some files didn't load ({loadErrors.length})
            </h3>
            <p className="mt-1 text-xs">
              The corresponding extractors found nothing to do. Common cause: WZ encryption
              version mismatch, or a corrupt/truncated file. Diagnostics on{' '}
              <Link to="/debug" className="underline">
                /debug
              </Link>{' '}
              have the full library output.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {loadErrors.map((e) => (
                <li key={e.name}>
                  <code className="font-mono">{e.name}</code> — {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <Link
            to="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium"
          >
            Open the wiki <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  const phase = loadM.isPending ? 'Loading files' : extract.isRunning ? 'Extracting' : 'Starting';
  const progress = loadProgress ?? extract.progress;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
        <div>
          <h2 className="text-lg font-semibold">{phase}</h2>
          <p className="text-muted-foreground text-sm">Hang tight — this only happens once.</p>
        </div>
      </div>
      {progress && (
        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <ProgressBar progress={progress} />
        </div>
      )}
    </section>
  );
}
