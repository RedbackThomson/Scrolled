// Shared shell for the home-page widgets — a titled section with an
// optional right-aligned action (e.g. "View all →") and a slotted body.
//
// Keeps every widget visually consistent without forcing them to know
// each other's Tailwind classes. Widgets render `null` when they have
// nothing to show; this component shouldn't be wrapped around an empty
// state — let the parent skip the section entirely.
//
// In edit mode the title + action are suppressed because the parent
// `SortableSection` renders its own header (drag handle, hide button,
// and the section label). Widgets opt in transparently by reading
// `HomeSectionContext` — they don't have to know about edit mode.

import { createContext, useContext, type ReactNode } from 'react';

interface HomeSectionCtx {
  editing: boolean;
}

const HomeSectionContext = createContext<HomeSectionCtx>({ editing: false });

export function HomeSectionProvider({
  editing,
  children,
}: {
  editing: boolean;
  children: ReactNode;
}) {
  return <HomeSectionContext.Provider value={{ editing }}>{children}</HomeSectionContext.Provider>;
}

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
  const { editing } = useContext(HomeSectionContext);
  return (
    <section className={className}>
      {!editing && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-foreground text-sm font-semibold uppercase tracking-wide">
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
