import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { Features } from '@/lib/useFeatures';
import { cn } from '@/lib/utils';
import { ALL_EXTRACTOR_KEYS, EXTRACTOR_DEPS, type ExtractorKey } from './plan';
import type { WizardFile } from './StepFiles';

/**
 * Maps each entity row's primary extractor key to the corresponding feature
 * flag and count field. Keeping this colocated with `EXTRACTOR_DEPS` would
 * couple the plan layer to UI feature gating; the indirection lives here.
 */
const ENTITY_FEATURE: Record<
  ExtractorKey,
  { flag: keyof Pick<Features, 'hasItems' | 'hasEquips' | 'hasMobs' | 'hasNpcs' | 'hasMaps' | 'hasQuests'>; countKey: 'items' | 'equips' | 'mobs' | 'npcs' | 'maps' | 'quests' }
> = {
  item: { flag: 'hasItems', countKey: 'items' },
  equip: { flag: 'hasEquips', countKey: 'equips' },
  mob: { flag: 'hasMobs', countKey: 'mobs' },
  npc: { flag: 'hasNpcs', countKey: 'npcs' },
  map: { flag: 'hasMaps', countKey: 'maps' },
  quest: { flag: 'hasQuests', countKey: 'quests' },
};

type ChipState = 'needed' | 'ready' | 'hashing' | 'already-loaded' | 'error';
type RowState =
  | 'loaded'
  | 'will-refresh'
  | 'will-load'
  | 'pending'
  | 'missing-deps'
  | 'empty';

interface Props {
  files: WizardFile[];
  features: Features;
  /** First-run hides the "Loaded — N items" affordance entirely. */
  mode: 'first-run' | 'update';
  /** Master "force re-process all" — affects whether a matched primary counts as a refresh. */
  forceAll: boolean;
}

export function EntityStatus({ files, features, mode, forceAll }: Props) {
  // Only included files count toward the entity status — matches the plan
  // builder, so unchecking a file in the dropped-files list immediately
  // reflects here as "not provided" for the categories it gated.
  const byName = new Map(files.filter((f) => f.include).map((f) => [f.file.name, f]));

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          What you'll be able to explore
        </h3>
        <p className="text-muted-foreground text-[11px]">
          Each category unlocks when its files are provided.
        </p>
      </div>
      <ul className="border-border divide-border divide-y rounded-md border">
        {ALL_EXTRACTOR_KEYS.map((key) => (
          <EntityRow
            key={key}
            ek={key}
            byName={byName}
            features={features}
            mode={mode}
            forceAll={forceAll}
          />
        ))}
      </ul>
    </section>
  );
}

function EntityRow({
  ek,
  byName,
  features,
  mode,
  forceAll,
}: {
  ek: ExtractorKey;
  byName: Map<string, WizardFile>;
  features: Features;
  mode: 'first-run' | 'update';
  forceAll: boolean;
}) {
  const dep = EXTRACTOR_DEPS[ek];
  const required = [dep.primary, ...dep.needs];
  const chips = required.map((n) => ({
    name: n,
    state: classifyChip(n, byName, features),
  }));

  const state = computeRowState(ek, chips, dep.primary, byName, features, mode, forceAll);
  const meta = ROW_META[state];

  const count = features.counts?.[ENTITY_FEATURE[ek].countKey];

  let statusLabel: string;
  if (state === 'loaded' && typeof count === 'number') {
    statusLabel = `Loaded · ${count.toLocaleString()}`;
  } else if (state === 'loaded') {
    statusLabel = 'Loaded';
  } else if (state === 'will-refresh') {
    statusLabel = 'Will refresh';
  } else if (state === 'will-load') {
    statusLabel = 'Ready to load';
  } else if (state === 'pending') {
    statusLabel = 'Reading…';
  } else if (state === 'missing-deps') {
    statusLabel = 'Needs more files';
  } else {
    statusLabel = 'Not enabled';
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
        state === 'missing-deps' && 'bg-amber-500/5',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-medium">{dep.label}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
            meta.badgeClass,
          )}
        >
          {state === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
          {statusLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <FileChip key={c.name} name={c.name} state={c.state} />
        ))}
      </div>
    </li>
  );
}

const ROW_META: Record<RowState, { badgeClass: string }> = {
  loaded: {
    badgeClass: 'bg-green-500/15 text-green-700 dark:text-green-300',
  },
  'will-refresh': {
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  },
  'will-load': {
    badgeClass: 'bg-green-500/15 text-green-700 dark:text-green-300',
  },
  pending: {
    badgeClass: 'bg-muted text-muted-foreground',
  },
  'missing-deps': {
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  empty: {
    badgeClass: 'bg-muted/60 text-muted-foreground',
  },
};

function classifyChip(
  name: string,
  byName: Map<string, WizardFile>,
  features: Features,
): ChipState {
  const wf = byName.get(name);
  if (wf) {
    if (wf.hashPhase === 'error') return 'error';
    if (wf.hashPhase === 'queued' || wf.hashPhase === 'hashing') return 'hashing';
    if (wf.matchedExisting) return 'already-loaded';
    return 'ready';
  }
  if (features.loadedFiles.has(name)) return 'already-loaded';
  return 'needed';
}

function computeRowState(
  ek: ExtractorKey,
  chips: { name: string; state: ChipState }[],
  primary: string,
  byName: Map<string, WizardFile>,
  features: Features,
  mode: 'first-run' | 'update',
  forceAll: boolean,
): RowState {
  const primaryChip = chips.find((c) => c.name === primary)!;
  const companionChips = chips.filter((c) => c.name !== primary);
  const wf = byName.get(primary);

  // Primary is in the dropped files for this run.
  if (wf) {
    if (primaryChip.state === 'hashing') return 'pending';
    if (primaryChip.state === 'error') return 'missing-deps'; // borrow the warning state
    const someCompanionMissing = companionChips.some((c) => c.state === 'needed');
    if (someCompanionMissing) return 'missing-deps';
    const forced = forceAll || wf.forceReprocess;
    // Hash-matched primary without force → no new extraction, treat as already-loaded.
    if (wf.matchedExisting && !forced) {
      if (mode === 'update' && features[ENTITY_FEATURE[ek].flag]) return 'loaded';
      return 'will-load';
    }
    if (mode === 'update' && features[ENTITY_FEATURE[ek].flag]) return 'will-refresh';
    return 'will-load';
  }

  // Primary not present this run — but the feature may already be loaded
  // from a prior session.
  if (mode === 'update' && features[ENTITY_FEATURE[ek].flag]) return 'loaded';
  return 'empty';
}

const CHIP_META: Record<
  ChipState,
  { className: string; Icon: typeof CheckCircle2 | null; title: string }
> = {
  needed: {
    className:
      'border-border text-muted-foreground border border-dashed bg-transparent',
    Icon: null,
    title: 'Not provided yet',
  },
  ready: {
    className:
      'border-transparent bg-green-500/15 text-green-700 dark:text-green-300',
    Icon: CheckCircle2,
    title: 'Ready',
  },
  hashing: {
    className:
      'border-transparent bg-muted text-muted-foreground',
    Icon: Loader2,
    title: 'Reading…',
  },
  'already-loaded': {
    className:
      'border-transparent bg-green-500/10 text-green-700/80 dark:text-green-300/80',
    Icon: CheckCircle2,
    title: 'Already loaded',
  },
  error: {
    className:
      'border-transparent bg-destructive/15 text-destructive',
    Icon: XCircle,
    title: 'Error',
  },
};

function FileChip({ name, state }: { name: string; state: ChipState }) {
  const meta = CHIP_META[state];
  const Icon = meta.Icon;
  return (
    <span
      title={meta.title}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium',
        meta.className,
      )}
    >
      {Icon && <Icon className={cn('h-3 w-3', state === 'hashing' && 'animate-spin')} />}
      {name}
    </span>
  );
}
