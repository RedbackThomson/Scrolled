import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import type { WzMapleVersionName } from '@/parser';
import { shortHash } from '@/lib/hashFile';
import { buildPlan } from './plan';
import type { WizardFile } from './StepFiles';

interface Props {
  version: WzMapleVersionName;
  files: WizardFile[];
}

export function StepReview({ version, files }: Props) {
  const plan = buildPlan(files);
  const willProcess = files.filter((f) => f.include && (!f.matchedExisting || f.forceReprocess));
  const loadOnly = files.filter((f) => f.include && f.matchedExisting && !f.forceReprocess);
  const excluded = files.filter((f) => !f.include);
  const totalBytes = plan.filesToLoad.reduce((acc, f) => acc + f.file.size, 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Ready to extract</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Review the plan and click Start. Extraction runs locally in a Web Worker; you can navigate
          to other parts of the app while it's running but please keep the tab open.
        </p>
      </div>

      <dl className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
        <Row label="Encryption version" value={version} />
        <Row
          label="Files to load"
          value={`${plan.filesToLoad.length} (${(totalBytes / 1_000_000).toFixed(1)} MB total)`}
        />
        <Row
          label="Extractors to run"
          value={plan.willRun.length === 0 ? 'none' : plan.willRun.map((r) => r.label).join(', ')}
        />
        {loadOnly.length > 0 && (
          <Row
            label="Load-only (skip extraction)"
            value={`${loadOnly.length} file${loadOnly.length === 1 ? '' : 's'} — kept in memory for cross-reference`}
          />
        )}
        {excluded.length > 0 && (
          <Row
            label="Excluded"
            value={`${excluded.length} file${excluded.length === 1 ? '' : 's'} (features hidden)`}
          />
        )}
      </dl>

      {plan.missingDeps.length > 0 && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Missing required files
          </div>
          <p className="mb-2 text-xs">
            One or more extractors depend on companion files that aren't in this run.
            Cross-references (item names, mob names, quest titles, …) come from{' '}
            <code className="font-mono">String.wz</code>. Drop the missing files into the previous
            step — hash-matched ones will load fast without re-extracting.
          </p>
          <ul className="space-y-1">
            {plan.missingDeps.map((d) => (
              <li key={d.extractor} className="text-xs">
                <code className="font-mono">{d.extractor}</code> needs:{' '}
                {d.missing.map((m, i) => (
                  <span key={m}>
                    {i > 0 && ', '}
                    <code className="font-mono">{m}</code>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.willRun.length === 0 && plan.missingDeps.length === 0 && (
        <div className="border-amber-500/40 bg-amber-500/10 rounded-md border p-4 text-sm">
          <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            Nothing to extract
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
            None of the included files trigger an extractor. Drop at least one of{' '}
            <code className="font-mono">Item.wz</code>, <code className="font-mono">Mob.wz</code>,{' '}
            <code className="font-mono">Npc.wz</code>, <code className="font-mono">Map.wz</code>, or{' '}
            <code className="font-mono">Quest.wz</code> (or mark an existing one as Force
            re-process).
          </p>
        </div>
      )}

      {plan.willRun.length > 0 && plan.missingDeps.length === 0 && (
        <div className="border-border bg-card text-card-foreground rounded-md border p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4" />
            Plan
          </div>
          <ul className="space-y-1 text-xs">
            {plan.willRun.map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span>
                  Extract <strong>{r.label}</strong>
                </span>
                <code className="text-muted-foreground font-mono">{r.primary}</code>
                {r.forced && (
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                    forced
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(willProcess.length > 0 || loadOnly.length > 0) && (
        <ul className="text-xs">
          {willProcess.map((f) => (
            <li key={f.file.name} className="border-border flex items-center gap-2 border-b py-1.5">
              <span className="text-muted-foreground inline-block w-3 text-center">▸</span>
              <span className="font-mono">{f.file.name}</span>
              <span className="text-muted-foreground">
                {(f.file.size / 1_000_000).toFixed(1)} MB · sha256:{shortHash(f.hash)}…
              </span>
            </li>
          ))}
          {loadOnly.map((f) => (
            <li
              key={f.file.name}
              className="text-muted-foreground border-border flex items-center gap-2 border-b py-1.5"
            >
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              <span className="font-mono">{f.file.name}</span>
              <span>load-only — provides cross-reference data to other extractors</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
