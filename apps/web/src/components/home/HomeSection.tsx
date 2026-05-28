// Shared shell for the home-page widgets — a titled section with an
// optional right-aligned action (e.g. "View all →") and a slotted body.
//
// Keeps every widget visually consistent without forcing them to know
// each other's Tailwind classes. Widgets render `null` when they have
// nothing to show; this component shouldn't be wrapped around an empty
// state — let the parent skip the section entirely.

import type { ReactNode } from 'react';

export function HomeSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}
