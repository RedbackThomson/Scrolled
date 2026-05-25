import { useHotkey } from '@tanstack/react-hotkeys';
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from '@/components/ui/command';
import { useCommandPalette } from '@/lib/useCommandPalette';
import {
  CollectionsContextProvider,
  CollectionsCreateProvider,
  CollectionsNavigationProvider,
} from './providers/collections';
import { ContextProvider } from './providers/context';
import { DataProvider } from './providers/data';
import { FilterKeysHintProvider } from './providers/filterKeys';
import { FilterProvider } from './providers/filters';
import { FunProvider } from './providers/fun';
import { GlobalSearchProvider } from './providers/globalSearch';
import { HelpProvider } from './providers/help';
import { NavigationProvider } from './providers/navigation';
import { PinCurrentProvider, PinnedSearchesProvider } from './providers/pinned';
import { RecentsProvider } from './providers/recents';
import { TogglesProvider } from './providers/toggles';

export function Palette() {
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const toggle = useCommandPalette((s) => s.toggle);
  const query = useCommandPalette((s) => s.query);
  const setQuery = useCommandPalette((s) => s.setQuery);

  useHotkey('Mod+K', () => toggle());

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter={false}
      footer={<PaletteFooter />}
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search or jump to… (type ? for shortcuts)"
      />
      <CommandList>
        <HelpProvider />
        <FilterKeysHintProvider />
        <CommandEmpty>No results.</CommandEmpty>
        {/* Page-bound context commands rank above everything else. */}
        <ContextProvider />
        <CollectionsContextProvider />
        <PinCurrentProvider />
        {/* Parsed-input commands (filter syntax) — also explicit user intent. */}
        <FilterProvider />
        {/* Personal curation above globals. */}
        <RecentsProvider />
        <PinnedSearchesProvider />
        {/* Search results. */}
        <GlobalSearchProvider />
        {/* Static navigation and write actions. */}
        <NavigationProvider />
        <CollectionsNavigationProvider />
        <CollectionsCreateProvider />
        <TogglesProvider />
        <DataProvider />
        <FunProvider />
      </CommandList>
    </CommandDialog>
  );
}

function PaletteFooter() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          navigate
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>↵</Kbd>
          select
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>esc</Kbd>
          close
        </span>
      </div>
      <span className="inline-flex items-center gap-1">
        <Kbd>?</Kbd>
        shortcuts
      </span>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-background text-muted-foreground inline-flex h-4 min-w-[1rem] select-none items-center justify-center rounded border px-1 font-mono text-[10px]">
      {children}
    </kbd>
  );
}
