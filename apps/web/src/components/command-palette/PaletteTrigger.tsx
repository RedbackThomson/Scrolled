import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useCommandPalette } from '@/lib/useCommandPalette';
import { cn } from '@/lib/utils';

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
      className={cn(
        'border-input bg-background hover:bg-accent/40 focus-visible:ring-ring relative flex h-9 w-full max-w-xl items-center gap-2 rounded-md border pl-9 pr-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <span className="text-muted-foreground flex-1 truncate">
        Search or jump to…
      </span>
      <kbd className="bg-muted text-muted-foreground pointer-events-none ml-2 hidden h-5 select-none items-center gap-0.5 rounded border px-1.5 font-mono text-[10px] sm:inline-flex">
        {isMac ? '⌘' : 'Ctrl'}
        <span>K</span>
      </kbd>
    </button>
  );
}
