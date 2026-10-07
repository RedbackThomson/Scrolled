// Full-screen block shown when on-device storage can't be opened and both DBs
// fall back to an in-memory engine. Modeled on a browser certificate warning:
// a hard stop by default, with the raw diagnostics and a deliberate
// "continue anyway" escape hatch tucked behind an Advanced disclosure so only
// users who understand the consequence (everything is lost on reload) take it.

import { ChevronRight } from 'lucide-react';
import { Button, Scrolly } from '@scrolled/design';
import { useStorageBypass } from '@/stores/storageBypass';
import type { StorageFailure } from '@/hooks/useStorageHealth';

export function StorageUnavailableScreen({ failures }: { failures: StorageFailure[] }) {
  const bypass = useStorageBypass((s) => s.bypass);

  return (
    <div
      className="text-foreground fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto bg-[var(--surface-page)] bg-[image:var(--gradient-page)] px-6 py-10"
      role="alert"
    >
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Scrolly pose="sleepy" size={84} />
          <div className="space-y-2">
            <h1 className="font-display text-xl font-semibold">
              Your library can't be saved on this device
            </h1>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Something is preventing this site from storing data on your device. Until it's fixed,
              anything you load is kept only in memory - everything will be erased the moment you
              reload or close the tab, so you'd have to load your game files again every visit.
            </p>
          </div>
        </div>

        <div className="border-border bg-card shadow-rim space-y-2 rounded-lg border-2 p-4">
          <p className="font-display text-[15px] font-semibold">What you can try</p>
          <ol className="text-muted-foreground list-decimal space-y-1.5 pl-5 text-[13px]">
            <li>
              If you're using a private or incognito window, open this page in a normal window —
              private windows usually block on-device storage.
            </li>
            <li>Make sure you're on a secure (https) connection.</li>
            <li>Try a current version of a major browser.</li>
            <li>Turn off strict privacy settings or extensions for this site, then reload.</li>
          </ol>
        </div>

        <Button type="button" size="lg" fullWidth onClick={() => window.location.reload()}>
          Reload and try again
        </Button>

        <details className="border-border group rounded-lg border-2 border-dashed">
          <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-sm">
            <ChevronRight
              className="h-4 w-4 transition-transform group-open:rotate-90"
              aria-hidden
            />
            Advanced
          </summary>
          <div className="border-border space-y-4 border-t-2 border-dashed px-3 py-3">
            {failures.map((f) => (
              <div key={f.label} className="space-y-1.5">
                <p className="text-xs font-medium">{f.label}</p>
                <p className="text-muted-foreground text-xs">{f.reason}</p>
                {f.detail && (
                  <pre className="bg-muted text-muted-foreground max-h-48 overflow-auto whitespace-pre-wrap rounded-md p-2 font-mono text-[11px] leading-relaxed">
                    {f.detail}
                  </pre>
                )}
              </div>
            ))}

            <div className="border-muted space-y-2 border-t-2 pt-3">
              <p className="text-muted-foreground text-xs">
                You can proceed without saving. Everything you load will be lost when you reload or
                close this tab, and you'll see this warning again next time. Only continue if you
                understand that.
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={bypass}>
                Continue without saving
              </Button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
