import { cn } from '@scrolled/design';

/** Square icon trigger for list toolbars; `open` adds the accent ring while its popover is up. */
export function toolbarIconButton(open: boolean) {
  return cn(
    'border-border bg-card text-foreground ease-spring inline-flex h-9 w-9 cursor-pointer max-md:h-11 max-md:w-11 items-center justify-center rounded-md border-2 shadow-[var(--shadow-btn-secondary)] transition-transform duration-300 hover:-translate-y-0.5',
    open && 'border-primary ring-primary/30 ring-4',
  );
}
