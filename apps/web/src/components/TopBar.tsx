import { ThemeToggle } from '@/components/ThemeToggle';
import { PaletteTrigger } from '@/components/command-palette/PaletteTrigger';

export function TopBar() {
  return (
    <header className="border-border bg-background sticky top-0 z-10 flex h-14 items-center gap-3 border-b px-4">
      <div className="max-w-xl flex-1">
        <PaletteTrigger />
      </div>
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}
