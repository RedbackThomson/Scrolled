import { Check } from 'lucide-react';
import { ACCENTS } from '@/lib/accents';
import { useAccent } from '@/stores/accent';
import { cn } from '@/lib/utils';

/**
 * Row of accent swatches. Reads and writes the accent store directly, so it
 * needs no props and can drop into Settings, the wizard, or anywhere else.
 */
export function AccentPicker() {
  const accent = useAccent((s) => s.accent);
  const setAccent = useAccent((s) => s.setAccent);

  return (
    <div className="flex items-center gap-2">
      {ACCENTS.map((a) => {
        const active = a.name === accent;
        return (
          <button
            key={a.name}
            type="button"
            onClick={() => setAccent(a.name)}
            aria-label={a.label}
            aria-pressed={active}
            title={a.label}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition',
              'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'focus-visible:ring-offset-card',
              active
                ? 'ring-foreground ring-2 ring-offset-2 ring-offset-card'
                : 'hover:scale-110',
            )}
            style={{ backgroundColor: a.swatch }}
          >
            {active && <Check className="h-4 w-4 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
