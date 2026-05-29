// Inline name prompt used by the filter-badges row's Save button.
//
// Renders as an expanding row of input + Save / Cancel so the user names
// the view without leaving the table. Writes to `pinned_searches` via the
// shared `useCreatePinnedSearch` mutation — same backing store as the
// toolbar's Saved Searches dropdown, which is the load-only surface.
//
// Reads `window.location.search` at submit (same approach
// `PinnedSearchesMenu` uses) because nuqs updates the URL via
// `history.replaceState` without flushing through `useLocation`.

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCreatePinnedSearch } from '@/hooks/usePinnedSearches';
import type { CollectionEntityType } from '@/db/user';

interface SaveSearchPromptProps {
  entity: CollectionEntityType;
  onDone: () => void;
}

export function SaveSearchPrompt({ entity, onDone }: SaveSearchPromptProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createM = useCreatePinnedSearch();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      await createM.mutateAsync({ name: trimmed, entity, params });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onDone();
          }
        }}
        placeholder="Name this view…"
        className="border-input bg-background focus-visible:ring-ring h-7 w-44 rounded-md border px-2 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-xs"
      />
      <Button
        type="button"
        size="sm"
        onClick={() => void submit()}
        disabled={!name.trim() || createM.isPending}
      >
        {createM.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onDone}>
        Cancel
      </Button>
      {error && <span className="text-destructive ml-2 text-[11px]">{error}</span>}
    </div>
  );
}
