import { SearchX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  cn,
  EmptyState,
  ErrorState,
  HopLoader,
  InfoList,
  Panel,
  SectionHeader,
  Skeleton,
} from '@scrolled/design';
import { appConfig } from '@/config';
import { useIsMobile } from '@/hooks/useIsMobile';
import { DetailTabs, type DetailTab } from './DetailTabs';
import { partitionDetailChildren } from './partitionDetailChildren';

export function DetailPageLoading({ entity, id }: { entity: string; id: number | string }) {
  return (
    <div className="space-y-6 py-6">
      <HopLoader size={56} label={`Loading ${entity.toLowerCase()} ${id}`} />
      <Skeleton rows={5} />
    </div>
  );
}

export function DetailPageError({
  entity,
  error,
  onRetry,
}: {
  entity: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="pt-10">
      <ErrorState
        title={`Couldn't load this ${entity.toLowerCase()}`}
        body="The library returned an error. Your data is safe."
        details={error instanceof Error ? error.message : String(error)}
        onRetry={onRetry}
      />
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

function AsidePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Panel as="aside" gap={16} className={cn('min-w-0 text-sm', className)}>
      {children}
    </Panel>
  );
}

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
        {aside !== undefined && <AsidePanel className="self-start">{aside}</AsidePanel>}
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
    ...(aside !== undefined
      ? [{ key: INFO_TAB, label: 'Info', panel: <AsidePanel>{aside}</AsidePanel> }]
      : []),
    ...sections.map((s) => ({ key: s.key, label: s.label, count: s.count, panel: s.node })),
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
          {aside !== undefined && <AsidePanel>{aside}</AsidePanel>}
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
    <section className="space-y-2">
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <SectionHeader title={title} size="panel" />
      <InfoList>{children}</InfoList>
    </section>
  );
}

export function SourceSection({ path }: { path: string }) {
  return (
    <section className="space-y-1.5">
      <SectionHeader title="Source" size="panel" />
      <code className="text-muted-foreground break-all font-mono text-xs">{path}</code>
    </section>
  );
}
