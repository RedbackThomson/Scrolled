import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '@scrolled/design';
import { appConfig } from '@/config';
import { usePageTitle } from '@/hooks/usePageTitle';

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
  usePageTitle(title);
  return (
    <div className="max-w-6xl space-y-3">
      <header>
        <h1 className="font-display text-2xl font-semibold leading-none md:text-4xl">{title}</h1>
        {description && <p className="text-muted-foreground mt-2 text-sm">{description}</p>}
      </header>

      <section className="space-y-3 md:space-y-3">
        {isEmpty ? (
          <Panel as="div" padding={24} className="text-center text-sm">
            <p className="text-muted-foreground">
              {appConfig.features.enableUserImport ? (
                <>
                  No {entityPlural} loaded yet.{' '}
                  <Link to="/setup" className="text-primary hover:underline">
                    Run setup
                  </Link>{' '}
                  to add them.
                </>
              ) : (
                <>No {entityPlural} available.</>
              )}
            </p>
          </Panel>
        ) : (
          children
        )}
      </section>
    </div>
  );
}
