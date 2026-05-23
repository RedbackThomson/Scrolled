import { CheckCircle2 } from 'lucide-react';
import type { WzMapleVersionName } from '@/parser';
import { shortHash } from '@/lib/hashFile';
import type { WizardFile } from './StepFiles';

interface Props {
  version: WzMapleVersionName;
  files: WizardFile[];
}

export function StepReview({ version, files }: Props) {
  const willProcess = files.filter((f) => f.include && (!f.matchedExisting || f.forceReprocess));
  const willSkip = files.filter((f) => f.include && f.matchedExisting && !f.forceReprocess);
  const excluded = files.filter((f) => !f.include);

  const totalBytes = willProcess.reduce((acc, f) => acc + f.file.size, 0);

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
          label="Files to process"
          value={`${willProcess.length} (${(totalBytes / 1_000_000).toFixed(1)} MB total)`}
        />
        {willSkip.length > 0 && (
          <Row
            label="Skipping (hash unchanged)"
            value={`${willSkip.length} file${willSkip.length === 1 ? '' : 's'}`}
          />
        )}
        {excluded.length > 0 && (
          <Row
            label="Excluded"
            value={`${excluded.length} file${excluded.length === 1 ? '' : 's'} (features hidden)`}
          />
        )}
      </dl>

      {(willProcess.length > 0 || willSkip.length > 0) && (
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
          {willSkip.map((f) => (
            <li
              key={f.file.name}
              className="text-muted-foreground border-border flex items-center gap-2 border-b py-1.5"
            >
              <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
              <span className="font-mono">{f.file.name}</span>
              <span>already loaded — will skip extraction</span>
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
