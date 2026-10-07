import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

// Tailwind can't build class names dynamically, so each tone is a full,
// statically-analyzable string. Add a tone here rather than constructing
// `bg-${color}` at call sites.
const TONES = {
  slate: 'bg-muted text-muted-foreground',
  pink: 'bg-[oklch(0.72_0.12_350/.2)] text-[color:oklch(var(--chip-fg-l)_0.14_350)]',
  red: 'bg-[oklch(0.72_0.12_25/.2)] text-[color:oklch(var(--chip-fg-l)_0.14_25)]',
  amber: 'bg-[oklch(0.72_0.12_75/.2)] text-[color:oklch(var(--chip-fg-l)_0.14_75)]',
  blue: 'bg-[oklch(0.72_0.12_245/.2)] text-[color:oklch(var(--chip-fg-l)_0.14_245)]',
  emerald: 'bg-[oklch(0.72_0.12_150/.2)] text-[color:oklch(var(--chip-fg-l)_0.14_150)]',
  violet: 'bg-[oklch(0.72_0.12_295/.2)] text-[color:oklch(var(--chip-fg-l)_0.14_295)]',
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = 'slate',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-[9px] py-0.5 text-[11.5px] font-bold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
