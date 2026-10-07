import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Upload } from 'lucide-react';
import { Button } from '@scrolled/design';
import { SetupCelebration } from './SetupCelebration';

export type RestoreState =
  | { phase: 'pending' }
  | {
      phase: 'success';
      backend: 'opfs' | 'memory';
      schemaVersion: number;
      /** Which databases the backup restored. */
      imported: ('game' | 'user')[];
      /** Non-blocking notices (e.g. an older-but-readable data revision). */
      warnings: string[];
    }
  | { phase: 'error'; error: Error };

const RESTORED_LABELS: Record<'game' | 'user', string> = {
  game: 'game data',
  user: 'collections',
};

interface Props {
  file: File;
  state: RestoreState;
  /** Caller swaps the file (e.g. after an error → user drops a different one). */
  onPickAgain: () => void;
  /** Caller flips the wizard back to fresh-import mode. */
  onSwitchBack: () => void;
  /** Mode at the time the restore was triggered — drives a contextual line. */
  parentMode: 'first-run' | 'update';
}

/**
 * Single-page restore flow. The parent owns the actual `db.importBytes`
 * call (so it runs exactly once per dropped file, immune to React 18
 * StrictMode's effect double-fire). This component is presentational:
 * given a {pending|success|error} state, render the matching card.
 */
export function StepRestore({ file, state, onPickAgain, onSwitchBack, parentMode }: Props) {
  const sizeMb = (file.size / 1_000_000).toFixed(1);

  if (state.phase === 'success') {
    const restored = state.imported.map((k) => RESTORED_LABELS[k]).join(' and ') || 'your library';
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <SetupCelebration />
          <div>
            <h2 className="font-display animate-rise text-xl font-semibold [animation-delay:300ms]">
              Backup restored
            </h2>
            <p className="text-muted-foreground animate-rise text-sm [animation-delay:380ms]">
              Restored {restored} from {file.name} ({sizeMb} MB). Your wiki is ready.
            </p>
          </div>
        </div>
        {state.warnings.map((w) => (
          <p key={w} className="text-xs text-amber-700 dark:text-amber-300">
            {w}
          </p>
        ))}
        <div>
          <Link
            to="/"
            className="text-primary-foreground ease-spring inline-flex h-9 items-center gap-2 rounded-md bg-[image:var(--gradient-accent)] px-4 text-[13px] font-bold shadow-[var(--shadow-btn)] transition-transform duration-300 hover:-translate-y-0.5"
          >
            Go Explore! <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  if (state.phase === 'error') {
    return (
      <section className="space-y-4">
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-xl border-2 p-4">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Couldn't restore from this file
          </div>
          <p className="text-sm">{state.error.message ?? 'Unknown error during restore.'}</p>
          <p className="mt-2 text-xs">
            Make sure the file is a backup exported from this app — a{' '}
            <code className="font-mono">.scrolled-backup</code> file. Older{' '}
            <code className="font-mono">.sqlite3</code> exports still work too.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={onPickAgain}>
            <Upload className="h-4 w-4" /> Drop a different backup
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSwitchBack}>
            <ArrowLeft className="h-4 w-4" /> Switch back to importing game files
          </Button>
        </div>
      </section>
    );
  }

  // In-flight.
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="text-primary h-6 w-6 animate-spin" />
        <div>
          <h2 className="font-display text-xl font-semibold">Restoring your wiki</h2>
          <p className="text-muted-foreground text-sm">
            Loading {file.name} ({sizeMb} MB) into your local database. This usually takes a few
            seconds.
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Your wiki database is being replaced with the contents of the backup. Once this finishes
        you'll go straight to the app.
        {parentMode === 'update' &&
          ' Anything that was previously loaded on this device is replaced.'}
      </p>
    </section>
  );
}
