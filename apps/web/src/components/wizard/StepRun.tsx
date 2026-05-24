import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import type { WzMapleVersionName } from '@/parser';
import { POOL_WORKER_NAMES, type PoolWorkerName } from '@/parser';
import {
  useWizardExtract,
  type WorkerStatus,
} from '@/lib/useWizardExtract';
import { cn } from '@/lib/utils';
import { buildPlan } from './plan';
import type { WizardFile } from './StepFiles';

interface Props {
  version: WzMapleVersionName;
  files: WizardFile[];
  onComplete: () => void;
}

const WORKER_LABELS: Record<PoolWorkerName, string> = {
  items: 'Items + Equips',
  mobs: 'Mobs',
  npcs: 'NPCs',
  maps: 'Maps',
  quests: 'Quests',
};

/**
 * Runs the wizard's extraction in parallel across the parser pool.
 *
 * Each primary WZ file (Item.wz, Mob.wz, Npc.wz, Map.wz, Quest.wz) gets
 * its own worker. The workers load their files in parallel and then run
 * their extractors in parallel; per-worker progress bars stack below.
 * The single shared dataset row is written at the end.
 */
export function StepRun({ version, files, onComplete }: Props) {
  const plan = useMemo(() => buildPlan(files), [files]);

  const droppedFiles = useMemo(
    () => plan.filesToLoad.map((f) => ({ name: f.file.name, source: f.file })),
    [plan.filesToLoad],
  );
  const willRunKeys = useMemo(() => new Set(plan.willRun.map((r) => r.key)), [plan.willRun]);

  const extract = useWizardExtract({
    version,
    droppedFiles,
    willRunKeys,
    recordFiles: plan.recordFiles,
    label: `${version} · ${new Date().toLocaleDateString()}`,
  });

  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    extract.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedRef = useRef(false);
  useEffect(() => {
    if (extract.stats && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [extract.stats, onComplete]);

  const activeWorkers = POOL_WORKER_NAMES.filter((n) => extract.workers[n].active);
  const failedWorkers = activeWorkers.filter((n) => extract.workers[n].phase === 'failed');

  if (extract.error && failedWorkers.length === 0) {
    return (
      <section className="space-y-4">
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4">
          <h3 className="font-semibold">Extraction failed</h3>
          <p className="mt-1 text-sm">{(extract.error as Error).message}</p>
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
        {failedWorkers.length > 0 && (
          <div className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 rounded-md border p-4">
            <h3 className="text-sm font-semibold">
              Some workers failed ({failedWorkers.length})
            </h3>
            <p className="mt-1 text-xs">
              Diagnostics on{' '}
              <Link to="/debug" className="underline">
                /debug
              </Link>{' '}
              have the full error chain.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {failedWorkers.map((n) => (
                <li key={n}>
                  <strong>{WORKER_LABELS[n]}</strong> — {extract.workers[n].error}
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

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
        <div>
          <h2 className="text-lg font-semibold">Running in parallel</h2>
          <p className="text-muted-foreground text-sm">
            One worker per WZ file. Hang tight — this only happens once.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {activeWorkers.map((name) => (
          <li key={name}>
            <WorkerCard name={name} status={extract.workers[name]} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function WorkerCard({ name, status }: { name: PoolWorkerName; status: WorkerStatus }) {
  const icon =
    status.phase === 'done' ? (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
    ) : status.phase === 'failed' ? (
      <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
    ) : (
      <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
    );

  const phaseLabel =
    status.phase === 'loading'
      ? 'Loading'
      : status.phase === 'extracting'
        ? 'Extracting'
        : status.phase === 'done'
          ? 'Done'
          : status.phase === 'failed'
            ? 'Failed'
            : 'Waiting';

  return (
    <div
      className={cn(
        'border-border bg-card text-card-foreground rounded-md border p-3',
        status.phase === 'failed' && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <strong>{WORKER_LABELS[name]}</strong>
        <span className="text-muted-foreground text-xs">· {phaseLabel}</span>
        <span className="text-muted-foreground ml-auto font-mono text-xs">
          {status.files.join(' + ')}
        </span>
      </div>
      {status.progress && status.phase !== 'done' && status.phase !== 'failed' && (
        <div className="mt-2">
          <ProgressBar progress={status.progress} />
        </div>
      )}
      {status.error && (
        <p className="text-destructive mt-2 inline-flex items-center gap-1.5 text-xs">
          <AlertTriangle className="h-3 w-3" /> {status.error}
        </p>
      )}
    </div>
  );
}

