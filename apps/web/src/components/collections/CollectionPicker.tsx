// Checkbox-list popover used wherever the user can toggle membership for
// a single entity — hover-card "Save" trigger and entity-detail badge
// strip both render this. Portaled with the same conventions as
// `ColumnFilter.tsx`: outside-click and Escape close, recompute position
// on resize / scroll.
//
// Toggling a row's checkbox adds the entity to that collection and reveals
// a small panel underneath with quantity + note inputs, so a user can set
// "need 5x — drops from Zakum" in one place without opening the collection
// detail page.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useCollectionsList,
  useCreateCollection,
  useMembership,
  useToggleMembership,
  useUpdateMember,
} from '@/hooks/useCollections';
import type { CollectionEntityType, MembershipBadge } from '@/db/user';
import { cn } from '@/lib/utils';

interface CollectionPickerProps {
  entityType: CollectionEntityType;
  entityId: number;
  /** Trigger element. Click toggles the popover. */
  children: (args: { open: boolean; toggle: () => void; memberCount: number }) => ReactNode;
}

export function CollectionPicker({ entityType, entityId, children }: CollectionPickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const collectionsQ = useCollectionsList();
  const membershipQ = useMembership(entityType, entityId);
  const toggleM = useToggleMembership();
  const createM = useCreateCollection();

  const membershipByCollection = useMemo(() => {
    const m = new Map<number, MembershipBadge>();
    for (const row of membershipQ.data ?? []) m.set(row.collectionId, row);
    return m;
  }, [membershipQ.data]);

  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const list = collectionsQ.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [collectionsQ.data, query]);

  // Position popover under trigger.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      setCoords({ top: r.bottom + 4, left: r.left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const onToggleMembership = useCallback(
    (collectionId: number) => {
      const isMember = membershipByCollection.has(collectionId);
      toggleM.mutate({ collectionId, entityType, entityId, member: !isMember });
    },
    [membershipByCollection, toggleM, entityType, entityId],
  );

  const onCreateAndAdd = useCallback(async () => {
    const name = query.trim();
    if (!name) return;
    const created = await createM.mutateAsync({ name });
    await toggleM.mutateAsync({
      collectionId: created.id,
      entityType,
      entityId,
      member: true,
    });
    setQuery('');
  }, [query, createM, toggleM, entityType, entityId]);

  // "Create" footer appears when search has no exact match.
  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (collectionsQ.data ?? []).some((c) => c.name.toLowerCase() === q);
  }, [collectionsQ.data, query]);

  return (
    <>
      <span ref={triggerRef} className="inline-flex">
        {children({ open, toggle, memberCount: membershipByCollection.size })}
      </span>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Add to collection"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-72 rounded-md border shadow-md"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-border border-b p-2">
              <div className="relative">
                <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or create…"
                  className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border pl-8 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !hasExactMatch && query.trim()) {
                      e.preventDefault();
                      onCreateAndAdd();
                    }
                  }}
                />
              </div>
            </div>
            <ul
              className="max-h-72 overflow-y-auto py-1"
              aria-busy={collectionsQ.isPending || membershipQ.isPending}
            >
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
                filtered.map((c) => {
                  const membership = membershipByCollection.get(c.id);
                  return (
                    <PickerRow
                      key={c.id}
                      collectionId={c.id}
                      collectionName={c.name}
                      collectionMemberCount={c.memberCount}
                      membership={membership}
                      entityType={entityType}
                      entityId={entityId}
                      onToggle={() => onToggleMembership(c.id)}
                    />
                  );
                })
              )}
            </ul>
            {!hasExactMatch && query.trim() && (
              <div className="border-border border-t p-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={onCreateAndAdd}
                  disabled={createM.isPending}
                >
                  {createM.isPending ? (
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
    </>
  );
}

interface PickerRowProps {
  collectionId: number;
  collectionName: string;
  collectionMemberCount: number;
  membership: MembershipBadge | undefined;
  entityType: CollectionEntityType;
  entityId: number;
  onToggle: () => void;
}

function PickerRow({
  collectionId,
  collectionName,
  collectionMemberCount,
  membership,
  entityType,
  entityId,
  onToggle,
}: PickerRowProps) {
  const isMember = !!membership;
  const updateM = useUpdateMember();

  const [qtyDraft, setQtyDraft] = useState<string>(
    membership?.quantity == null ? '' : String(membership.quantity),
  );
  const [noteDraft, setNoteDraft] = useState<string>(membership?.note ?? '');

  // Re-sync drafts whenever the server-side row changes (toggling
  // membership off then on resets to blank; another surface editing the
  // same row needs to land here too).
  useEffect(() => {
    setQtyDraft(membership?.quantity == null ? '' : String(membership.quantity));
  }, [membership?.quantity]);
  useEffect(() => {
    setNoteDraft(membership?.note ?? '');
  }, [membership?.note]);

  const commitQty = () => {
    if (!membership) return;
    const trimmed = qtyDraft.trim();
    let next: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        // Reject — reset to last good value.
        setQtyDraft(membership.quantity == null ? '' : String(membership.quantity));
        return;
      }
      next = Math.floor(n);
    }
    if (next === (membership.quantity ?? null)) return;
    updateM.mutate({
      collectionId,
      entityType,
      entityId,
      patch: { quantity: next },
    });
  };

  const commitNote = () => {
    if (!membership) return;
    const trimmed = noteDraft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next === (membership.note ?? null)) return;
    updateM.mutate({
      collectionId,
      entityType,
      entityId,
      patch: { note: next },
    });
  };

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs',
          isMember && 'bg-accent/40',
        )}
      >
        <span
          className={cn(
            'border-input flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
            isMember && 'bg-primary border-primary text-primary-foreground',
          )}
          aria-hidden
        >
          {isMember && <Check className="h-2.5 w-2.5" />}
        </span>
        <span className={cn('min-w-0 flex-1 truncate', isMember && 'font-medium')}>
          {collectionName}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {collectionMemberCount}
        </span>
      </button>
      {isMember && (
        <div
          className={cn(
            'bg-accent/20 border-border space-y-1.5 border-b border-t px-3 py-2 pl-[1.65rem]',
          )}
          // The panel sits inside the same <li> as the trigger, so clicks
          // here mustn't bubble up and re-toggle the checkbox.
          onClick={(e) => e.stopPropagation()}
        >
          <label className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-12 shrink-0 uppercase tracking-wide">Qty</span>
            <input
              type="number"
              min={0}
              value={qtyDraft}
              onChange={(e) => setQtyDraft(e.target.value)}
              onBlur={commitQty}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="—"
              aria-label={`Quantity for ${collectionName}`}
              className="border-input bg-background focus-visible:ring-ring h-6 w-20 rounded-md border px-1.5 text-[11px] tabular-nums focus-visible:outline-none focus-visible:ring-2"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-12 shrink-0 uppercase tracking-wide">
              Note
            </span>
            <input
              type="text"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={commitNote}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                } else if (e.key === 'Escape') {
                  setNoteDraft(membership?.note ?? '');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Optional note"
              aria-label={`Note for ${collectionName}`}
              className="border-input bg-background focus-visible:ring-ring h-6 min-w-0 flex-1 rounded-md border px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2"
            />
          </label>
        </div>
      )}
    </li>
  );
}
