import { Loader2, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn, EmptyState } from '@scrolled/design';
import { appConfig } from '@/config';

export function DetailPageLoading({ entity, id }: { entity: string; id: number | string }) {
  return (
    <p className="text-muted-foreground flex items-center gap-2 py-6 text-[13px]">
      <Loader2 className="text-primary h-4 w-4 animate-spin" /> Loading {entity.toLowerCase()} {id}…
    </p>
  );
}

export function DetailPageNotFound({ entity, id }: { entity: string; id: number | string }) {
  return (
    <div className="pt-10">
      <EmptyState
        icon={SearchX}
        title={`${entity} not found`}
        body={
          appConfig.features.enableUserImport ? (
            <>
              {entity} <code className="font-mono">{id}</code> isn't in your library yet. It may not
              have been loaded —{' '}
              <Link to="/setup" className="text-primary hover:underline">
                visit Setup
              </Link>{' '}
              to add more files.
            </>
          ) : (
            <>
              {entity} <code className="font-mono">{id}</code> isn't in this dataset.
            </>
          )
        }
      />
    </div>
  );
}

interface DetailPageLayoutProps {
  header: ReactNode;
  aside?: ReactNode;
  /** Defaults to the design's 1010px content width; pass a wider class for maps and quests. */
  maxWidth?: string;
  children: ReactNode;
}

export function DetailPageLayout({
  header,
  aside,
  maxWidth = 'max-w-[1010px]',
  children,
}: DetailPageLayoutProps) {
  return (
    <div className={cn(maxWidth, 'space-y-3')}>
      <div
        className={cn(
          'grid items-start gap-3 md:gap-6',
          aside !== undefined && 'sm:grid-cols-[minmax(0,1fr)_288px]',
        )}
      >
        <article className="min-w-0 space-y-3.5 p-1 md:p-0">
          {header}
          {children}
        </article>
        {aside !== undefined && (
          <aside className="border-border bg-card text-card-foreground shadow-rim min-w-0 space-y-4 self-start rounded-lg border-2 p-4 text-sm">
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * A main-content section for the intro content that sits above the list
 * sections — descriptions, previews, minimaps, etc. Same heading as
 * `DetailListSection`, without the icon or count.
 */
export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display mb-2 text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display mb-1.5 text-[15px] font-semibold">{title}</h2>
      <dl className="divide-muted divide-y-[1.5px]">{children}</dl>
    </section>
  );
}

interface InfoRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
}

export function InfoRow({ label, value, mono = false }: InfoRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 px-0.5 py-1.5">
      <dt className="text-muted-foreground text-[12.5px] font-semibold">{label}</dt>
      <dd className={cn('text-right font-semibold', mono && 'font-mono text-[12.5px]')}>{value}</dd>
    </div>
  );
}

export function SourceSection({ path }: { path: string }) {
  return (
    <section>
      <h2 className="font-display mb-1.5 text-[15px] font-semibold">Source</h2>
      <code className="text-muted-foreground break-all font-mono text-xs">{path}</code>
    </section>
  );
}
