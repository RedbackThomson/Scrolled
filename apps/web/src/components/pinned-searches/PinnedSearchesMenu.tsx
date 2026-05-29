// Listing-page popover for loading pinned searches.
//
// Toolbar button → portaled popover listing the saved searches scoped to
// the current entity. Clicking a row navigates to the saved URL; the X
// next to each row deletes it. Saving moved to the filter-badge row's
// Save button (see `SaveSearchPrompt`), which writes through the same
// `pinned_searches` table — this surface is read-only.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronDown, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePopover } from '@/hooks/usePopover';
import { useDeletePinnedSearch, usePinnedSearches } from '@/hooks/usePinnedSearches';
import { listingRouteForEntity } from '@/lib/entityRoutes';
import type { CollectionEntityType } from '@/db/user';
import { cn } from '@/lib/utils';

interface Props {
  entity: CollectionEntityType;
}

export function PinnedSearchesMenu({ entity }: Props) {
  const { open, setOpen, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();
  const navigate = useNavigate();
  const [status, setStatus] = useState<string | null>(null);

  const allQ = usePinnedSearches();
  const deleteM = useDeletePinnedSearch();

  const scoped = useMemo(
    () => (allQ.data ?? []).filter((p) => p.entity === entity),
    [allQ.data, entity],
  );

  // Status banner auto-clears so it doesn't outlive the popover open.
  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatus(null), 2500);
    return () => window.clearTimeout(t);
  }, [status]);

  const onLoad = (id: number) => {
    const p = scoped.find((s) => s.id === id);
    if (!p) return;
    const sp = new URLSearchParams(p.params);
    navigate(`${listingRouteForEntity(entity)}${sp.toString() ? `?${sp.toString()}` : ''}`);
    setOpen(false);
  };

  const onDelete = async (id: number, label: string) => {
    if (!confirm(`Delete saved search "${label}"?`)) return;
    try {
      await deleteM.mutateAsync(id);
      setStatus(`Deleted "${label}"`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen((o) => !o)}
        title="Saved searches for this page"
      >
        <Bookmark className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Saved Searches</span>
        {scoped.length > 0 && (
          <span className="text-muted-foreground font-mono text-[10px]">{scoped.length}</span>
        )}
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </Button>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Saved searches"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-80 max-w-[calc(100vw-1rem)] rounded-md border shadow-md"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-border border-b p-2">
              <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                Saved for this page
              </p>
            </div>
            <ul className="max-h-64 overflow-y-auto py-1" aria-busy={allQ.isPending}>
              {allQ.isPending ? (
                <li className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Loading…
                </li>
              ) : scoped.length === 0 ? (
                <li className="text-muted-foreground px-3 py-3 text-center text-xs">
                  No saved searches yet.
                </li>
              ) : (
                scoped.map((p) => (
                  <SavedRow
                    key={p.id}
                    label={p.name}
                    onLoad={() => onLoad(p.id)}
                    onDelete={() => void onDelete(p.id, p.name)}
                    deleting={deleteM.isPending}
                  />
                ))
              )}
            </ul>
            {status && (
              <div className="border-border text-muted-foreground border-t px-3 py-2 text-[11px]">
                {status}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

function SavedRow({
  label,
  onLoad,
  onDelete,
  deleting,
}: {
  label: string;
  onLoad: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onLoad}
        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 pr-8 text-left text-xs"
      >
        <Bookmark className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        disabled={deleting}
        aria-label={`Delete saved search "${label}"`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-1 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
