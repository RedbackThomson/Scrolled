import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Package,
  ScrollText,
  Shield,
  Skull,
  Users,
  XCircle,
  Map as MapIcon,
  type LucideIcon,
} from 'lucide-react';
import { AccentPicker } from '@/components/common/AccentPicker';
import { ProgressBar } from '@/components/common/ProgressBar';
import type { WzMapleVersionName } from '@/parser';
import {
  ALL_EXTRACTOR_KEYS,
  EXTRACTOR_LABEL,
  useWizardExtract,
  type ExtractorKey,
  type ExtractorStatus,
} from '@/hooks/extraction/useWizardExtract';
import { cn } from '@/lib/utils';
import { buildPlan } from './plan';
import type { WizardFile } from './StepFiles';

interface Props {
  version: WzMapleVersionName;
  files: WizardFile[];
  onComplete: () => void;
  mode: 'first-run' | 'update';
}

/** Per-category summary tiles, keyed by the count field on `ExtractStats`.
 *  Icons mirror the sidebar so the summary reads like the app it built. */
const SUMMARY_CARDS: {
  key: 'items' | 'equips' | 'mobs' | 'npcs' | 'maps' | 'quests';
  label: string;
  Icon: LucideIcon;
}[] = [
  { key: 'items', label: 'Items', Icon: Package },
  { key: 'equips', label: 'Equips', Icon: Shield },
  { key: 'mobs', label: 'Mobs', Icon: Skull },
  { key: 'npcs', label: 'NPCs', Icon: Users },
  { key: 'maps', label: 'Maps', Icon: MapIcon },
  { key: 'quests', label: 'Quests', Icon: ScrollText },
];

/**
 * Runs the wizard's extraction in parallel across the parser pool.
 *
 * Each primary WZ file (Item.wz, Mob.wz, Npc.wz, Map.wz, Quest.wz) gets
 * its own worker. Workers load their files in parallel and then run
 * their extractors in parallel; per-extractor progress bars stack below.
 * The items worker runs `item` then `equip` back-to-back, and they show
 * as two separate rows so the UI reflects the actual sequence.
 */
export function StepRun({ version, files, onComplete, mode }: Props) {
  const plan = useMemo(() => buildPlan(files), [files]);
  const kind = files[0]?.kind ?? 'wz';

  // Flatten to the underlying files: WZ contributes one (`Item.wz`), IMG one
  // per `.img` (named by its relative path, which the data source maps back to
  // a logical root).
  const droppedFiles = useMemo(
    () =>
      plan.filesToLoad.flatMap((f) =>
        f.members.map((m) => ({ name: m.relPath, source: m.file })),
      ),
    [plan.filesToLoad],
  );
  const willRunKeys = useMemo(() => new Set(plan.willRun.map((r) => r.key)), [plan.willRun]);

  const extract = useWizardExtract({
    version,
    kind,
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

  const activeExtractors = ALL_EXTRACTOR_KEYS.filter((k) => extract.extractors[k].active);
  const failedExtractors = activeExtractors.filter((k) => extract.extractors[k].phase === 'failed');

  if (extract.error && failedExtractors.length === 0) {
    return (
      <section className="space-y-4">
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4">
          <h3 className="font-semibold">Extraction failed</h3>
          <p className="mt-1 text-sm">{(extract.error as Error).message}</p>
        </div>
        <p className="text-muted-foreground text-sm">
          You can fix the issue and try again. The{' '}
          <Link to="/debug" className="text-primary hover:underline">
            Diagnostics
          </Link>{' '}
          page has the full error chain.
        </p>
      </section>
    );
  }

  if (extract.stats) {
    const stats = extract.stats;
    const loaded = SUMMARY_CARDS.filter((c) => stats[c.key] > 0);
    const total = loaded.reduce((n, c) => n + stats[c.key], 0);
    return (
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          <div>
            <h2 className="text-lg font-semibold">
              {mode === 'update' ? 'Update complete' : 'Your wiki is ready'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {total.toLocaleString()} entries indexed in {(stats.ms / 1000).toFixed(1)}s. Everything
              is stored on this device and ready to explore.
            </p>
          </div>
        </div>

        {loaded.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {loaded.map(({ key, label, Icon }) => (
              <li
                key={key}
                className="border-border bg-card text-card-foreground flex items-center gap-3 rounded-md border p-3"
              >
                <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-lg font-semibold tabular-nums leading-none">
                    {stats[key].toLocaleString()}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">{label}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {stats.skipped > 0 && (
          <p className="text-muted-foreground text-xs">
            {stats.skipped.toLocaleString()} entries were skipped because they had no name.
          </p>
        )}

        <div className="border-border flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
          <div>
            <div className="text-sm font-medium">Accent color</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Pick a highlight color. You can change it later in Settings.
            </p>
          </div>
          <AccentPicker />
        </div>

        {failedExtractors.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100">
            <h3 className="text-sm font-semibold">
              Some categories failed ({failedExtractors.length})
            </h3>
            <p className="mt-1 text-xs">
              The{' '}
              <Link to="/debug" className="underline">
                Diagnostics
              </Link>{' '}
              page has the full error chain.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {failedExtractors.map((k) => (
                <li key={k}>
                  <strong>{EXTRACTOR_LABEL[k]}</strong> — {extract.extractors[k].error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
        <div>
          <h2 className="text-lg font-semibold">
            {mode === 'update' ? 'Updating your wiki' : 'Building your wiki'}
          </h2>
          <p className="text-muted-foreground text-sm">
            Reading your files and indexing each category. This usually takes a minute or two; you
            can use the app once it's done.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {activeExtractors.map((k) => (
          <li key={k}>
            <ExtractorCard ek={k} status={extract.extractors[k]} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ExtractorCard({ ek, status }: { ek: ExtractorKey; status: ExtractorStatus }) {
  const icon =
    status.phase === 'done' ? (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
    ) : status.phase === 'failed' ? (
      <XCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
    ) : status.phase === 'waiting' ? (
      <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
    ) : (
      <Loader2 className="text-primary h-4 w-4 shrink-0 animate-spin" />
    );

  const phaseLabel =
    status.phase === 'loading'
      ? 'Loading'
      : status.phase === 'waiting'
        ? 'Queued'
        : status.phase === 'extracting'
          ? 'Indexing'
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
        <strong>{EXTRACTOR_LABEL[ek]}</strong>
        <span className="text-muted-foreground text-xs">· {phaseLabel}</span>
        <span className="text-muted-foreground ml-auto font-mono text-xs">
          {status.files.join(' + ')}
        </span>
      </div>
      {status.progress &&
        status.phase !== 'done' &&
        status.phase !== 'failed' &&
        status.phase !== 'waiting' && (
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
