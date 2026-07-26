import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@scrolled/ui';

import { wikiHomeUrl } from '@/lib/scrolledLinks';
import { ThemeToggle } from './ThemeToggle';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const wikiUrl = wikiHomeUrl();
  return (
    <div className="flex h-full flex-col">
      <header className="border-border bg-background flex h-12 flex-none items-center justify-between gap-3 border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          {wikiUrl ? (
            <a
              href={wikiUrl}
              className={cn(
                'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background -ml-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              )}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to Wiki
            </a>
          ) : null}
          <h1 className="text-sm font-semibold tracking-tight">Navigator</h1>
        </div>
        <ThemeToggle />
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
