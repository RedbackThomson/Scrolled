import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Switch, cn } from '@scrolled/design';
import { SlidersHorizontal } from 'lucide-react';
import type { NavGraph } from '@scrolled/nav-graph';

import { useDirections, type PathOptions } from '@/stores/useDirections';
import { RequirementUnlocks } from './RequirementUnlocks';

// Only the boolean travel toggles live in this list; the unlocked-requirements
// section is rendered separately from the graph's own requirements.
type BooleanOptionKey = {
  [K in keyof PathOptions]: PathOptions[K] extends boolean ? K : never;
}[keyof PathOptions];

interface OptionDef {
  key: BooleanOptionKey;
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
  {
    key: 'nearestTownScroll',
    label: 'Return scrolls',
    description: 'Warp to the nearest town when it is quicker.',
  },
];

export interface PathOptionsMenuProps {
  graph: NavGraph;
}

export function PathOptionsMenu({ graph }: PathOptionsMenuProps) {
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
        variant="secondary"
        size="sm"
        icon={SlidersHorizontal}
        aria-label="Travel setup"
        className={cn(
          'h-10 rounded-full px-3.5 max-md:h-11',
          open && 'border-primary ring-primary/30 ring-4',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {activeCount > 0 ? (
          <span className="bg-primary text-primary-foreground flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-bold tabular-nums">
            {activeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Travel setup"
          className="border-border bg-card text-card-foreground shadow-pop animate-tip absolute left-0 top-full z-20 mt-2 flex max-h-[min(70vh,32rem)] w-[calc(100vw-2rem)] max-w-80 origin-top-left flex-col overflow-y-auto rounded-[18px] border-2 p-4 md:left-auto md:right-0 md:w-80 md:origin-top-right"
        >
          <p className="font-display text-[17px] font-semibold">Travel setup</p>
          <p className="text-muted-foreground mt-0.5 text-[12.5px]">
            Configure your travel options
          </p>
          <div className="mt-3 flex flex-col gap-0.5">
            {OPTIONS.map((opt) => {
              const checked = options[opt.key];
              return (
                // A <label> forwards clicks on the text to the switch, so the whole row is the target.
                <label
                  key={opt.key}
                  className="hover:bg-muted flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{opt.label}</span>
                    <span className="text-muted-foreground block text-[12.5px]">
                      {opt.description}
                    </span>
                  </span>
                  <Switch
                    ariaLabel={opt.label}
                    checked={checked}
                    onChange={(next) => setOption(opt.key, next)}
                  />
                </label>
              );
            })}
          </div>
          <RequirementUnlocks graph={graph} />
        </div>
      ) : null}
    </div>
  );
}
