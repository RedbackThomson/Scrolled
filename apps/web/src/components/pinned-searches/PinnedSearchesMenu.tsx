// Listing-page popover that combines loading + saving pinned searches.
//
// Mirrors the CollectionsBulkAddMenu pattern: a toolbar button that opens
// a portal popover with two regions — the existing saved searches for
// the current entity at the top, and an inline "save current view"
// footer at the bottom. The button is always enabled; the footer's save
// is gated on `filtersActive` so the user discovers the affordance but
// doesn't accidentally save a default view.
//
// Reads `window.location.search` at submit time. The page-level URL
// state is driven by nuqs (`useQueryStates`), which updates the URL via
// `history.replaceState` without notifying `useLocation`; reading
// window.location directly sidesteps that integration gap.

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bookmark, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePopover } from '@/hooks/usePopover';
import {
  useCreatePinnedSearch,
  useDeletePinnedSearch,
  usePinnedSearches,
} from '@/hooks/usePinnedSearches';
import { listingRouteForEntity } from '@/lib/entityRoutes';
import type { CollectionEntityType } from '@/db/user';
import { cn } from '@/lib/utils';

interface Props {
  entity: CollectionEntityType;
  /** True when the user has applied any column filter or non-empty text
   *  search. Drives whether the inline "Save current view" row is
   *  enabled — kept as a prop because nuqs URL state doesn't reach
   *  useLocation, so the parent (which already reads the state) is the
   *  source of truth. */
  filtersActive: boolean;
}

export function PinnedSearchesMenu({ entity, filtersActive }: Props) {
  const { open, setOpen, coords, triggerRef, popoverRef } = usePopover<
    HTMLButtonElement,
    HTMLDivElement
  >();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const allQ = usePinnedSearches();
  const createM = useCreatePinnedSearch();
  const deleteM = useDeletePinnedSearch();

  // Only show pins for the page's entity — a Saved-mob-searches popover
  // mixing in Items would be confusing.
  const scoped = useMemo(
    () => (allQ.data ?? []).filter((p) => p.entity === entity),
    [allQ.data, entity],
  );

  // Reset transient form state every time the popover closes; otherwise a
  // half-typed name from the previous open would persist.
  useEffect(() => {
    if (!open) {
      setName('');
      setStatus(null);
    }
  }, [open]);

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

  const onSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || !filtersActive) return;
    try {
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      await createM.mutateAsync({ name: trimmed, entity, params });
      setStatus(`Saved "${trimmed}"`);
      setName('');
      // Close immediately after a successful save — the new pin shows up
      // in the home page and reopening the menu confirms it's there.
      setOpen(false);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Save failed');
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
        Saved Searches
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
            className="border-border bg-card text-card-foreground z-50 w-80 rounded-md border shadow-md"
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
            <div className="border-border border-t p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-muted-foreground text-[11px] uppercase tracking-wide">
                  Save current view
                </p>
                {!filtersActive && (
                  <p className="text-muted-foreground text-[10px]">Apply a filter first</p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void onSave();
                      }
                    }}
                    placeholder="Name this search…"
                    disabled={!filtersActive}
                    className="border-input bg-background focus-visible:ring-ring placeholder:text-muted-foreground h-7 w-full rounded-md border pl-7 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => void onSave()}
                  disabled={!filtersActive || !name.trim() || createM.isPending}
                >
                  {createM.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Save
                </Button>
              </div>
              {status && <p className="text-muted-foreground mt-2 text-[11px]">{status}</p>}
            </div>
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
