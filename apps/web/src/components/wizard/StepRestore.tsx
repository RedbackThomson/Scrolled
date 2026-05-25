import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type RestoreState =
  | { phase: 'pending' }
  | { phase: 'success'; backend: 'opfs' | 'memory'; schemaVersion: number }
  | { phase: 'error'; error: Error };

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
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          <div>
            <h2 className="text-lg font-semibold">Backup restored</h2>
            <p className="text-muted-foreground text-sm">
              Loaded {file.name} ({sizeMb} MB) · schema v{state.schemaVersion}. Your wiki is ready.
            </p>
          </div>
        </div>
        <div>
          <Link
            to="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium"
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
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Couldn't restore from this file
          </div>
          <p className="text-sm">{state.error.message ?? 'Unknown error during restore.'}</p>
          <p className="mt-2 text-xs">
            Make sure the file is a database export from this app — it should end in{' '}
            <code className="font-mono">.sqlite3</code> and look like a regular database file.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onPickAgain}>
            <Upload className="h-4 w-4" /> Drop a different backup
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSwitchBack}>
            <ArrowLeft className="h-4 w-4" /> Switch back to importing WZ files
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
          <h2 className="text-lg font-semibold">Restoring your wiki</h2>
          <p className="text-muted-foreground text-sm">
            Loading {file.name} ({sizeMb} MB) into your local database. This usually takes a few
            seconds.
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">
        Your wiki database is being replaced with the contents of the backup. Once this finishes
        you'll go straight to the app.
        {parentMode === 'update' && ' Anything that was previously loaded on this device is replaced.'}
      </p>
    </section>
  );
}
