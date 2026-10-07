import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@scrolled/design';

export interface WizardStep {
  id: string;
  label: string;
}

interface Props {
  title: string;
  subtitle?: string;
  steps: WizardStep[];
  currentStepId: string;
  children: ReactNode;
  footer?: ReactNode;
  /**
   * Rendered top-right of the header, opposite the title. Use for an
   * escape-hatch link (e.g. "Return to app") in update / restore modes.
   */
  exitSlot?: ReactNode;
}

/**
 * Full-page wizard chrome. Renders a fixed header with a horizontal step
 * indicator, the active step's content, and an optional sticky footer for
 * primary/secondary actions.
 */
export function WizardLayout({
  title,
  subtitle,
  steps,
  currentStepId,
  children,
  footer,
  exitSlot,
}: Props) {
  const currentIdx = Math.max(
    0,
    steps.findIndex((s) => s.id === currentStepId),
  );

  return (
    <div className="flex min-h-full flex-col">
      <header>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl font-semibold">{title}</h1>
              {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
            </div>
            {exitSlot && <div className="shrink-0">{exitSlot}</div>}
          </div>
          {steps.length > 0 && (
            <ol className="flex flex-wrap items-center gap-2 text-[13px]">
              {steps.map((step, idx) => {
                const state =
                  idx < currentIdx ? 'done' : idx === currentIdx ? 'current' : 'upcoming';
                return (
                  <li key={step.id} className="flex items-center gap-2">
                    <span
                      aria-current={state === 'current' ? 'step' : undefined}
                      className={cn(
                        'flex h-8 items-center gap-2 rounded-full py-1 pl-1 pr-3.5 font-semibold',
                        state === 'current'
                          ? 'text-primary-foreground bg-[image:var(--gradient-accent)] shadow-[var(--shadow-btn)]'
                          : 'bg-card shadow-float',
                        state === 'upcoming' && 'text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                          state === 'current' && 'bg-white/25',
                          state === 'done' && 'bg-primary text-primary-foreground',
                          state === 'upcoming' && 'bg-muted',
                        )}
                      >
                        {state === 'done' ? <Check className="h-3 w-3" /> : idx + 1}
                      </span>
                      {step.label}
                    </span>
                    {idx < steps.length - 1 && (
                      <span className="text-muted-foreground/50 mx-0.5" aria-hidden>
                        ·
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">{children}</div>
      </main>

      {footer && (
        <footer className="border-border bg-card/85 shadow-float sticky bottom-0 border-t-2 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 py-4">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}
