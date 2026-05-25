import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface TablePageLayoutProps {
  title: string;
  description?: ReactNode;
  /** True when the underlying query returned zero rows with no search/filter applied. */
  isEmpty?: boolean;
  /** Lowercase plural used in the empty message, e.g. "mobs" or "NPCs". */
  entityPlural: string;
  children: ReactNode;
}

export function TablePageLayout({
  title,
  description,
  isEmpty,
  entityPlural,
  children,
}: TablePageLayoutProps) {
  return (
    <div className="max-w-6xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 text-sm">{description}</p>}
      </header>

      <section className="space-y-3">
        {isEmpty ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No {entityPlural} loaded yet.{' '}
              <Link to="/setup" className="text-primary hover:underline">
                Run setup
              </Link>{' '}
              to add them.
            </p>
          </div>
        ) : (
          children
        )}
      </section>
    </div>
  );
}
