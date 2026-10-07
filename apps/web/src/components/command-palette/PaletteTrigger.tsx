import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { Kbd } from '@scrolled/design';

function detectMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPod|iPad/.test(navigator.platform || navigator.userAgent);
}

export function PaletteTrigger() {
  const setOpen = useCommandPalette((s) => s.setOpen);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(detectMac());
  }, []);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label="Open command palette"
      aria-keyshortcuts="Meta+K Control+K"
      className="bg-card text-muted-foreground shadow-float focus-visible:ring-primary/30 flex h-10 w-full items-center gap-2.5 rounded-full pl-4 pr-2 text-left focus-visible:outline-none focus-visible:ring-4 max-md:h-11"
    >
      <Search className="pointer-events-none h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">Search or jump to…</span>
      <span className="pointer-events-none hidden select-none sm:inline-flex">
        <Kbd>{isMac ? '⌘K' : 'Ctrl K'}</Kbd>
      </span>
    </button>
  );
}
