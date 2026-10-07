import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { CloudBackdrop, Logo } from '@scrolled/design';

import { wikiHomeUrl } from '@/lib/scrolledLinks';
import { ThemeToggle } from './ThemeToggle';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const wikiUrl = wikiHomeUrl();
  return (
    <div className="relative isolate flex h-full flex-col bg-[image:var(--gradient-page)]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <CloudBackdrop />
      </div>
      <header className="flex h-[60px] flex-none items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          {wikiUrl ? (
            <a
              href={wikiUrl}
              className="bg-card text-foreground shadow-float ease-spring focus-visible:ring-primary/30 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 max-md:h-11"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Wiki
            </a>
          ) : null}
          <div className="flex min-w-0 items-center gap-2">
            <Logo size={30} wordmark={false} />
            <h1 className="font-display truncate text-[19px] font-semibold leading-none">
              Navigator
            </h1>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
