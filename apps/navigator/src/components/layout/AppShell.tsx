import type { ReactNode } from 'react';
import { ThemeToggle } from './ThemeToggle';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-full flex-col">
      <header className="border-border bg-background flex h-12 flex-none items-center justify-between border-b px-4">
        <h1 className="text-sm font-semibold tracking-tight">Navigator</h1>
        <ThemeToggle />
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
