import { SearchX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn, EmptyState, Skeleton } from '@scrolled/design';
import { appConfig } from '@/config';
import { useIsMobile } from '@/hooks/useIsMobile';
import { DetailTabs, type DetailTab } from './DetailTabs';
import { partitionDetailChildren } from './partitionDetailChildren';

export function DetailPageLoading({ entity, id }: { entity: string; id: number | string }) {
  return (
    <div role="status" className="py-6">
      <span className="sr-only">
        Loading {entity.toLowerCase()} {id}…
      </span>
      <Skeleton rows={5} />
    </div>
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
  /** Headline stat tiles shown as a strip under the header on mobile. */
  stats?: ReactNode;
  /** Defaults to the design's 1010px content width; pass a wider class for maps and quests. */
  maxWidth?: string;
  children: ReactNode;
}

const ASIDE_CARD =
  'border-border bg-card text-card-foreground shadow-rim min-w-0 space-y-4 rounded-lg border-2 p-4 text-sm';

export function DetailPageLayout({
  header,
  aside,
  stats,
  maxWidth = 'max-w-[1010px]',
  children,
}: DetailPageLayoutProps) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <MobileDetailLayout header={header} aside={aside} stats={stats}>
        {children}
      </MobileDetailLayout>
    );
  }
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
        {aside !== undefined && <aside className={cn(ASIDE_CARD, 'self-start')}>{aside}</aside>}
      </div>
    </div>
  );
}

const INFO_TAB = 'info';

function MobileDetailLayout({
  header,
  aside,
  stats,
  children,
}: Omit<DetailPageLayoutProps, 'maxWidth'>) {
  const { intro, sections } = partitionDetailChildren(children);
  const [active, setActive] = useState<string | null>(null);
  const tabs: DetailTab[] = [
    ...sections.map((s) => ({ key: s.key, label: s.label, count: s.count, panel: s.node })),
    ...(aside !== undefined
      ? [{ key: INFO_TAB, label: 'Info', panel: <aside className={ASIDE_CARD}>{aside}</aside> }]
      : []),
  ];
  // A single panel needs no tab bar; fall back to the stacked layout.
  const tabbed = sections.length > 0 && tabs.length > 1;

  return (
    <article className="min-w-0 space-y-3.5 p-1">
      {header}
      {stats && (
        // Quarter-width tiles can't fit the tile's 19px values (HP runs to seven digits).
        <div className="grid grid-cols-4 gap-1.5 [&>*>span:last-child]:!text-[15px] [&>*>span:last-child]:[overflow-wrap:anywhere] [&>*]:min-w-0 [&>*]:!px-2">
          {stats}
        </div>
      )}
      {tabbed ? (
        <>
          {intro}
          <DetailTabs
            tabs={tabs}
            active={active && tabs.some((t) => t.key === active) ? active : tabs[0].key}
            onChange={setActive}
          />
        </>
      ) : (
        <>
          {children}
          {aside !== undefined && <aside className={ASIDE_CARD}>{aside}</aside>}
        </>
      )}
    </article>
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
