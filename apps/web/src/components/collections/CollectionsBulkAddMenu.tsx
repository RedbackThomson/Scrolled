// Toolbar control rendered into DataTable's `toolbarExtra` slot when the
// user has selected one or more rows. Opens a dropdown of every collection
// plus an inline "+ New collection". Clicking a collection bulk-adds the
// selected ids into it and clears the selection.

import { useEffect, useState } from 'react';
import { usePopover } from '@/hooks/usePopover';
import { createPortal } from 'react-dom';
import { BookmarkPlus, ChevronDown, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBulkAddMembers, useCollectionsList, useCreateCollection } from '@/hooks/useCollections';
import type { CollectionEntityType, EntityRef } from '@/db/user';
import { cn } from '@/lib/utils';

interface CollectionsBulkAddMenuProps {
  entityType: CollectionEntityType;
  /** Row ids from DataTable's `getRowId`. We parse them back to numeric
   *  entity ids — every entity in the app has a numeric primary key. */
  selectedIds: ReadonlySet<string>;
  onAdded?: (count: number) => void;
  onClear?: () => void;
}

export function CollectionsBulkAddMenu({
  entityType,
  selectedIds,
  onAdded,
  onClear,
}: CollectionsBulkAddMenuProps) {
  const { open, setOpen, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const collectionsQ = useCollectionsList();
  const bulkM = useBulkAddMembers();
  const createM = useCreateCollection();

  const count = selectedIds.size;

  // Auto-clear status after a short delay so it doesn't linger past the
  // next interaction.
  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), 3000);
    return () => window.clearTimeout(t);
  }, [status]);

  const filtered = (collectionsQ.data ?? []).filter((c) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q);
  });

  const refs: EntityRef[] = Array.from(selectedIds, (id) => ({
    entityType,
    entityId: Number(id),
  })).filter((r) => Number.isFinite(r.entityId));

  const addToCollection = async (collectionId: number, label: string) => {
    if (refs.length === 0) return;
    try {
      const result = await bulkM.mutateAsync({ collectionId, refs });
      const added = result.added;
      const skipped = result.skipped;
      const parts: string[] = [];
      if (added > 0) parts.push(`Added ${added} to ${label}`);
      if (skipped > 0) parts.push(`${skipped} already present`);
      setStatus(parts.join(' · ') || `Nothing changed`);
      setOpen(false);
      onAdded?.(added);
      if (added > 0) onClear?.();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Bulk add failed');
    }
  };

  const createAndAdd = async () => {
    const name = query.trim();
    if (!name) return;
    const created = await createM.mutateAsync({ name });
    await addToCollection(created.id, created.name);
    setQuery('');
  };

  const hasExactMatch = (collectionsQ.data ?? []).some(
    (c) => c.name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{count} selected</span>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={count === 0}
      >
        <BookmarkPlus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Add to collection</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={count === 0}>
        Clear
      </Button>
      {status && (
        <span className="text-muted-foreground text-xs" aria-live="polite">
          {status}
        </span>
      )}
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Add to collection"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-64 max-w-[calc(100vw-1rem)] rounded-md border shadow-md"
          >
            <div className="border-border border-b p-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or create…"
                  className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border pl-8 pr-2 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !hasExactMatch && query.trim()) {
                      e.preventDefault();
                      createAndAdd();
                    }
                  }}
                />
              </div>
            </div>
            <ul className="max-h-64 overflow-y-auto py-1">
              {collectionsQ.isPending ? (
                <li className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </li>
              ) : filtered.length === 0 ? (
                <li className="text-muted-foreground px-3 py-2 text-xs">
                  {query.trim() ? 'No matches' : 'No collections yet.'}
                </li>
              ) : (
                filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => addToCollection(c.id, c.name)}
                      className={cn(
                        'hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
                        bulkM.isPending && 'opacity-60',
                      )}
                      disabled={bulkM.isPending}
                    >
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                        {c.memberCount}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {!hasExactMatch && query.trim() && (
              <div className="border-border border-t p-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={createAndAdd}
                  disabled={createM.isPending || bulkM.isPending}
                >
                  {createM.isPending || bulkM.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  Create "{query.trim()}"
                </Button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}
