import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

// Tailwind can't build class names dynamically, so each tone is a full,
// statically-analyzable string. Add a tone here rather than constructing
// `bg-${color}` at call sites.
const TONES = {
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
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
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
