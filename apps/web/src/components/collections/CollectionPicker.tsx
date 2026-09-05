// Checkbox-list popover used wherever the user can toggle membership for
// a single entity — hover-card "Save" trigger and entity-detail badge
// strip both render this. Portaled with the same conventions as
// `ColumnFilter.tsx`: outside-click and Escape close, recompute position
// on resize / scroll.
//
// Checking a collection adds the entity to its default (ungrouped) bucket and
// reveals a panel: group chips let the user also place it in named groups (an
// entity can be in more than one group, at most once each), plus quantity +
// note inputs so a user can set "need 5x — drops from Zakum" in one place.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePopover } from '@/hooks/usePopover';
import { createPortal } from 'react-dom';
import { Check, Loader2, Plus, Search } from 'lucide-react';
import { Button } from '@scrolled/ui';
import {
  useCollectionGroups,
  useCollectionsList,
  useCreateCollection,
  useMembership,
  useToggleGroupPlacement,
  useToggleMembership,
  useUpdateMember,
} from '@/hooks/useCollections';
import type { CollectionEntityType, MembershipBadge } from '@/db/user';
import { cn } from '@scrolled/ui';

interface CollectionPickerProps {
  entityType: CollectionEntityType;
  entityId: number;
  /** Trigger element. Click toggles the popover. */
  children: (args: { open: boolean; toggle: () => void; memberCount: number }) => ReactNode;
}

export function CollectionPicker({ entityType, entityId, children }: CollectionPickerProps) {
  const { open, setOpen, coords, triggerRef, popoverRef } = usePopover<
    HTMLSpanElement,
    HTMLDivElement
  >();

  const collectionsQ = useCollectionsList();
  const membershipQ = useMembership(entityType, entityId);
  const toggleM = useToggleMembership();
  const createM = useCreateCollection();

  // One entity can hold several placements in a collection (different groups),
  // so group the membership rows by collection.
  const placementsByCollection = useMemo(() => {
    const m = new Map<number, MembershipBadge[]>();
    for (const row of membershipQ.data ?? []) {
      const list = m.get(row.collectionId);
      if (list) list.push(row);
      else m.set(row.collectionId, [row]);
    }
    return m;
  }, [membershipQ.data]);

  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const list = collectionsQ.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [collectionsQ.data, query]);

  const toggle = useCallback(() => setOpen((o) => !o), [setOpen]);

  const onToggleMembership = useCallback(
    (collectionId: number) => {
      const isMember = placementsByCollection.has(collectionId);
      toggleM.mutate({ collectionId, entityType, entityId, member: !isMember });
    },
    [placementsByCollection, toggleM, entityType, entityId],
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
        {children({ open, toggle, memberCount: placementsByCollection.size })}
      </span>
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Add to collection"
            style={{ position: 'fixed', top: coords.top, left: coords.left }}
            className="border-border bg-card text-card-foreground z-50 w-72 max-w-[calc(100vw-1rem)] rounded-md border shadow-md"
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
                  className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border pl-8 pr-2 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-xs"
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
                filtered.map((c) => (
                  <PickerRow
                    key={c.id}
                    collectionId={c.id}
                    collectionName={c.name}
                    collectionMemberCount={c.memberCount}
                    placements={placementsByCollection.get(c.id) ?? []}
                    entityType={entityType}
                    entityId={entityId}
                    onToggle={() => onToggleMembership(c.id)}
                  />
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
  placements: MembershipBadge[];
  entityType: CollectionEntityType;
  entityId: number;
  onToggle: () => void;
}

function PickerRow({
  collectionId,
  collectionName,
  collectionMemberCount,
  placements,
  entityType,
  entityId,
  onToggle,
}: PickerRowProps) {
  const isMember = placements.length > 0;
  const updateM = useUpdateMember();
  const togglePlacementM = useToggleGroupPlacement();
  // Only member rows need the group list, so the query stays disabled otherwise.
  const groupsQ = useCollectionGroups(isMember ? collectionId : null);

  const placedGroupIds = useMemo(() => {
    const s = new Set<number | null>();
    for (const p of placements) s.add(p.groupId);
    return s;
  }, [placements]);

  // Quantity + note edit one placement. Bind to the ungrouped one when present,
  // else the first placement — the common single-placement case is unchanged.
  const representative = useMemo(
    () => placements.find((p) => p.groupId == null) ?? placements[0],
    [placements],
  );

  const [qtyDraft, setQtyDraft] = useState<string>('');
  const [noteDraft, setNoteDraft] = useState<string>('');

  useEffect(() => {
    setQtyDraft(representative?.quantity == null ? '' : String(representative.quantity));
  }, [representative?.quantity]);
  useEffect(() => {
    setNoteDraft(representative?.note ?? '');
  }, [representative?.note]);

  const commitQty = () => {
    if (!representative) return;
    const trimmed = qtyDraft.trim();
    let next: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setQtyDraft(representative.quantity == null ? '' : String(representative.quantity));
        return;
      }
      next = Math.floor(n);
    }
    if (next === (representative.quantity ?? null)) return;
    updateM.mutate({
      collectionId,
      entityType,
      entityId,
      groupId: representative.groupId,
      patch: { quantity: next },
    });
  };

  const commitNote = () => {
    if (!representative) return;
    const trimmed = noteDraft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next === (representative.note ?? null)) return;
    updateM.mutate({
      collectionId,
      entityType,
      entityId,
      groupId: representative.groupId,
      patch: { note: next },
    });
  };

  const togglePlacement = (groupId: number | null) => {
    togglePlacementM.mutate({
      collectionId,
      entityType,
      entityId,
      groupId,
      present: !placedGroupIds.has(groupId),
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
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground mr-0.5 w-8 shrink-0 text-[10px] uppercase tracking-wide">
              In
            </span>
            <GroupChip
              label="Ungrouped"
              active={placedGroupIds.has(null)}
              onClick={() => togglePlacement(null)}
            />
            {(groupsQ.data ?? []).map((g) => (
              <GroupChip
                key={g.id}
                label={g.name}
                active={placedGroupIds.has(g.id)}
                onClick={() => togglePlacement(g.id)}
              />
            ))}
          </div>
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
              className="border-input bg-background focus-visible:ring-ring h-6 w-20 rounded-md border px-1.5 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 sm:text-[11px]"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-12 shrink-0 uppercase tracking-wide">Note</span>
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
                  setNoteDraft(representative?.note ?? '');
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Optional note"
              aria-label={`Note for ${collectionName}`}
              className="border-input bg-background focus-visible:ring-ring h-6 min-w-0 flex-1 rounded-md border px-1.5 text-base focus-visible:outline-none focus-visible:ring-2 sm:text-[11px]"
            />
          </label>
        </div>
      )}
    </li>
  );
}

function GroupChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors',
        active
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground border-dashed',
      )}
    >
      {active ? <Check className="h-2.5 w-2.5" aria-hidden /> : <Plus className="h-2.5 w-2.5" aria-hidden />}
      <span className="max-w-[7rem] truncate">{label}</span>
    </button>
  );
}
