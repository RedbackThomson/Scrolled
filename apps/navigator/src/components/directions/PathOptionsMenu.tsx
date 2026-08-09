import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, cn } from '@scrolled/ui';
import { SlidersHorizontal } from 'lucide-react';

import { useDirections, type PathOptions } from '@/stores/useDirections';

interface OptionDef {
  key: keyof PathOptions;
  label: string;
  description: string;
}

// The set of traveller settings the menu exposes. Add a row here (and a field
// on PathOptions) as new items / unlocked paths become route-affecting.
const OPTIONS: OptionDef[] = [
  {
    key: 'fastTravel',
    label: 'Fast-travel ticket',
    description: 'Boats, trains and carpets are treated as instant.',
  },
];

export function PathOptionsMenu() {
  const options = useDirections((s) => s.options);
  const setOption = useDirections((s) => s.setOption);
  const acknowledged = useDirections((s) => s.optionsAcknowledged);
  const acknowledgeOptions = useDirections((s) => s.acknowledgeOptions);

  // Auto-open on first visit (before the user has seen it) to draw attention to
  // the settings — they change routing enough to matter before Get Directions.
  const [open, setOpen] = useState(() => !useDirections.getState().optionsAcknowledged);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    if (!acknowledged) acknowledgeOptions();
  }, [acknowledged, acknowledgeOptions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  const activeCount = OPTIONS.filter((o) => options[o.key]).length;

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('gap-2', open && 'ring-ring ring-2 ring-offset-1')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {activeCount > 0 ? (
          <span className="bg-primary text-primary-foreground ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Travel setup"
          className="border-border bg-card text-card-foreground absolute right-0 top-full z-20 mt-2 w-72 rounded-md border p-3 shadow-md"
        >
          <p className="text-sm font-medium">Travel setup</p>
          <p className="text-muted-foreground mt-0.5 text-xs">Configure your travel options</p>
          <div className="mt-3 flex flex-col gap-1">
            {OPTIONS.map((opt) => {
              const checked = options[opt.key];
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => setOption(opt.key, !checked)}
                  className="hover:bg-accent flex items-start gap-3 rounded-md p-2 text-left transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="text-muted-foreground block text-xs">{opt.description}</span>
                  </span>
                  <span
                    className={cn(
                      'relative mt-0.5 inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors',
                      checked ? 'bg-primary' : 'bg-muted border-border border',
                    )}
                  >
                    <span
                      className={cn(
                        'bg-background inline-block h-4 w-4 rounded-full shadow transition-transform',
                        checked ? 'translate-x-4' : 'translate-x-0.5',
                      )}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
