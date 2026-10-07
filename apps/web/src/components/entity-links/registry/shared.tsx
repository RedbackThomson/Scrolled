import type { ReactNode } from 'react';
import { cn } from '@scrolled/design';

/** A small pill used for boolean flags in tooltip meta rows. */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Numeric value with aligned digits, in whatever font its slot uses. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="text-foreground tabular-nums">{children}</span>;
}
