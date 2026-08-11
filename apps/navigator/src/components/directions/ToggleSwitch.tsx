import { cn } from '@scrolled/ui';

/**
 * The sliding-pill visual of a switch. Purely presentational — the caller owns
 * the interactive element (a `role="switch"` button) and its `aria-checked`.
 */
export function ToggleSwitch({ checked }: { checked: boolean }) {
  return (
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
  );
}
