import { ArrowLeft, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface BackLink {
  to: string;
  label: string;
}

const BACK_LINK_CLASS = 'text-primary inline-flex items-center gap-1 text-sm hover:underline';

export function BackLinkButton({ back }: { back: BackLink }) {
  return (
    <Link to={back.to} className={BACK_LINK_CLASS}>
      <ArrowLeft className="h-4 w-4" /> {back.label}
    </Link>
  );
}

export function DetailPageLoading({ entity, id }: { entity: string; id: number | string }) {
  return (
    <p className="text-muted-foreground text-sm">
      <Loader2 className="inline h-4 w-4 animate-spin" /> Loading {entity.toLowerCase()} {id}…
    </p>
  );
}

export function DetailPageNotFound({
  entity,
  id,
  back,
}: {
  entity: string;
  id: number | string;
  back: BackLink;
}) {
  return (
    <div className="max-w-3xl">
      <BackLinkButton back={back} />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">{entity} not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        {entity} <code className="font-mono">{id}</code> isn't in your library yet. It may not have
        been loaded —{' '}
        <Link to="/setup" className="text-primary hover:underline">
          visit Setup
        </Link>{' '}
        to add more files.
      </p>
    </div>
  );
}

interface DetailPageLayoutProps {
  back: BackLink;
  header: ReactNode;
  aside?: ReactNode;
  /** Defaults to `max-w-4xl`; pass `max-w-5xl` for wider pages (maps, quests). */
  maxWidth?: string;
  children: ReactNode;
}

export function DetailPageLayout({
  back,
  header,
  aside,
  maxWidth = 'max-w-4xl',
  children,
}: DetailPageLayoutProps) {
  return (
    <div className={cn(maxWidth, 'space-y-6')}>
      <BackLinkButton back={back} />
      <div className={cn('grid gap-6', aside !== undefined && 'sm:grid-cols-[1fr_18rem]')}>
        <article className="space-y-6">
          {header}
          {children}
        </article>
        {aside !== undefined && (
          <aside className="border-border bg-card text-card-foreground space-y-4 self-start rounded-md border p-4 text-sm">
            {aside}
          </aside>
        )}
      </div>
    </div>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">{title}</h2>
      <dl className="divide-border divide-y">{children}</dl>
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
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className={mono ? 'font-mono text-sm' : 'text-sm'}>{value}</dd>
    </div>
  );
}

export function SourceSection({ path }: { path: string }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Source</h2>
      <p className="text-muted-foreground text-[10px] uppercase tracking-wide">WZ path</p>
      <code className="text-muted-foreground break-all font-mono text-xs">{path}</code>
    </section>
  );
}
