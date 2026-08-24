import type { ReactNode } from 'react';
import { cn } from '@scrolled/ui';

/** A small pill used for boolean flags in tooltip meta rows. */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Monospace numeric value, matching the tooltip stat styling. */
export function Mono({ children }: { children: ReactNode }) {
  return <span className="text-foreground font-mono">{children}</span>;
}
