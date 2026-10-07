// Checkbox-list popover used wherever the user can toggle membership for
// a single entity — the hover-card footer and the detail-page Save button
// both render this. Portaled with the same conventions as
// `ColumnFilter.tsx`: outside-click and Escape close, recompute position
// on resize / scroll.
//
// Checking a collection adds the entity to its default (ungrouped) bucket and
// reveals a panel: group chips let the user also place it in named groups (an
// entity can be in more than one group, at most once each), plus quantity +
// note inputs so a user can set "need 5x — drops from Zakum" in one place.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePopover } from '@/hooks/usePopover';
import { BookmarkCheck, Check, Loader2, Plus, Search } from 'lucide-react';
import { ConfettiBurst, Input } from '@scrolled/design';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { showToast } from '@/stores/toasts';
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
import { cn } from '@scrolled/design';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import { CollectionFormDialog } from './CollectionFormDialog';
import { resolveCollectionColor } from './colorRegistry';
import { resolveCollectionIcon } from './iconRegistry';

interface CollectionPickerProps {
  entityType: CollectionEntityType;
  entityId: number;
  /** Shown in the popover header when known. */
  entityName?: string;
  /** Trigger element. Click toggles the popover. `saves` counts adds this session, for celebrating them. */
  children: (args: {
    open: boolean;
    toggle: () => void;
    memberCount: number;
    saves: number;
  }) => ReactNode;
}

export function CollectionPicker({
  entityType,
  entityId,
  entityName,
  children,
}: CollectionPickerProps) {
  const { open, setOpen, close, coords, triggerRef, popoverRef } = usePopover<
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

  const { motion } = useMotionPrefs();
  const [saves, setSaves] = useState(0);
  // Web Animations bypass the CSS motion kill switch, so this checks the setting itself.
  const celebrate = useCallback(() => {
    setSaves((n) => n + 1);
    if (motion) {
      triggerRef.current?.animate?.(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(0.88, 0.82)', offset: 0.25 },
          { transform: 'scale(1.08, 1.1)', offset: 0.6 },
          { transform: 'scale(1)' },
        ],
        { duration: 620, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
      );
    }
  }, [motion, triggerRef]);

  const announceSave = useCallback(
    (collectionId: number, name: string) =>
      showToast({
        message: `Saved to ${name}`,
        icon: BookmarkCheck,
        action: {
          label: 'Undo',
          run: () => toggleM.mutate({ collectionId, entityType, entityId, member: false }),
        },
      }),
    [toggleM, entityType, entityId],
  );

  const onToggleMembership = useCallback(
    (collectionId: number) => {
      const isMember = placementsByCollection.has(collectionId);
      toggleM.mutate({ collectionId, entityType, entityId, member: !isMember });
      if (!isMember) {
        celebrate();
        const name = collectionsQ.data?.find((c) => c.id === collectionId)?.name;
        if (name) announceSave(collectionId, name);
      }
    },
    [
      placementsByCollection,
      toggleM,
      entityType,
      entityId,
      celebrate,
      collectionsQ.data,
      announceSave,
    ],
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
    celebrate();
    announceSave(created.id, created.name);
    setQuery('');
  }, [query, createM, toggleM, entityType, entityId, celebrate, announceSave]);

  const [formOpen, setFormOpen] = useState(false);
  const onFormSaved = useCallback(
    (created: { id: number; name: string }) => {
      toggleM.mutate({ collectionId: created.id, entityType, entityId, member: true });
      celebrate();
      announceSave(created.id, created.name);
    },
    [toggleM, entityType, entityId, celebrate, announceSave],
  );
  const isMobile = useIsMobile();
  const savedIn = placementsByCollection.size;

  // With a query that names no existing collection, the footer creates it directly.
  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (collectionsQ.data ?? []).some((c) => c.name.toLowerCase() === q);
  }, [collectionsQ.data, query]);

  return (
    <>
      <span ref={triggerRef} className="relative inline-flex">
        {children({ open, toggle, memberCount: placementsByCollection.size, saves })}
        <ConfettiBurst trigger={saves} />
      </span>
      {open && (
        <PopoverPanel
          label="Add to collection"
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName="w-72"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {!isMobile && coords && <Notch trigger={triggerRef.current} panelLeft={coords.left} />}
          <div className="space-y-2 p-2.5 pb-2">
            <div className="px-0.5">
              {entityName && (
                <div className="font-display truncate text-[15px] font-semibold leading-tight">
                  {entityName}
                </div>
              )}
              <div className="text-muted-foreground text-xs">
                {savedIn > 0
                  ? `Saved in ${savedIn} ${savedIn === 1 ? 'collection' : 'collections'}`
                  : 'Not saved yet'}
              </div>
            </div>
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a collection…"
                aria-label="Find a collection"
                className="bg-muted focus-visible:ring-primary/30 h-8 w-full rounded-full pl-8 pr-2 text-base focus-visible:outline-none focus-visible:ring-4 sm:text-xs"
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
            className="border-muted max-h-72 space-y-0.5 overflow-y-auto border-t-2 p-1.5"
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
                  collectionIcon={c.icon}
                  collectionColor={c.color}
                  collectionMemberCount={c.memberCount}
                  placements={placementsByCollection.get(c.id) ?? []}
                  entityType={entityType}
                  entityId={entityId}
                  onToggle={() => onToggleMembership(c.id)}
                />
              ))
            )}
          </ul>
          <div className="border-muted bg-muted rounded-b-[16px] border-t-2 p-1.5">
            {!hasExactMatch && query.trim() ? (
              <button
                type="button"
                onClick={onCreateAndAdd}
                disabled={createM.isPending}
                className="text-primary hover:bg-card flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-bold disabled:opacity-60"
              >
                {createM.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                )}
                <span className="min-w-0 truncate">Create "{query.trim()}"</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="text-primary hover:bg-card flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-bold"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                New collection…
              </button>
            )}
          </div>
        </PopoverPanel>
      )}
      <CollectionFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={onFormSaved}
      />
    </>
  );
}

interface PickerRowProps {
  collectionId: number;
  collectionName: string;
  collectionIcon: string | null;
  collectionColor: string | null;
  collectionMemberCount: number;
  placements: MembershipBadge[];
  entityType: CollectionEntityType;
  entityId: number;
  onToggle: () => void;
}

function PickerRow({
  collectionId,
  collectionName,
  collectionIcon,
  collectionColor,
  collectionMemberCount,
  placements,
  entityType,
  entityId,
  onToggle,
}: PickerRowProps) {
  const isMember = placements.length > 0;
  const togglePlacementM = useToggleGroupPlacement();
  // Only member rows need the group list, so the query stays disabled otherwise.
  const groupsQ = useCollectionGroups(isMember ? collectionId : null);

  const placedGroupIds = useMemo(() => {
    const s = new Set<number | null>();
    for (const p of placements) s.add(p.groupId);
    return s;
  }, [placements]);

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
          'hover:bg-muted flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-semibold',
          isMember && 'bg-muted',
        )}
      >
        <span
          className={cn(
            'border-border bg-card flex h-5 w-5 shrink-0 items-center justify-center rounded-[7px] border-2',
            isMember &&
              'text-primary-foreground border-transparent bg-[image:var(--gradient-accent)] shadow-[inset_0_-2px_0_var(--accent-lo)]',
          )}
          aria-hidden
        >
          {isMember && <Check className="h-3 w-3" />}
        </span>
        <CollectionGlyph icon={collectionIcon} color={collectionColor} />
        <span className={cn('min-w-0 flex-1 truncate', isMember && 'font-medium')}>
          {collectionName}
        </span>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {collectionMemberCount}
        </span>
      </button>
      {isMember && (
        <div
          className="bg-muted space-y-1.5 rounded-md px-3 py-2 pl-[2.4rem]"
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
          <div className="space-y-2">
            {placements.map((p) => (
              <PlacementEditor
                key={p.groupId ?? 'default'}
                collectionId={collectionId}
                entityType={entityType}
                entityId={entityId}
                placement={p}
                showLabel={placements.length > 1}
              />
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

interface PlacementEditorProps {
  collectionId: number;
  entityType: CollectionEntityType;
  entityId: number;
  placement: MembershipBadge;
  /** Show the group name above the inputs, so several placements can be told
   *  apart. Hidden when there's only one. */
  showLabel: boolean;
}

function PlacementEditor({
  collectionId,
  entityType,
  entityId,
  placement,
  showLabel,
}: PlacementEditorProps) {
  const updateM = useUpdateMember();
  const [qtyDraft, setQtyDraft] = useState<string>(
    placement.quantity == null ? '' : String(placement.quantity),
  );
  const [noteDraft, setNoteDraft] = useState<string>(placement.note ?? '');

  useEffect(() => {
    setQtyDraft(placement.quantity == null ? '' : String(placement.quantity));
  }, [placement.quantity]);
  useEffect(() => {
    setNoteDraft(placement.note ?? '');
  }, [placement.note]);

  const label = placement.groupName ?? 'Ungrouped';

  const commitQty = () => {
    const trimmed = qtyDraft.trim();
    let next: number | null = null;
    if (trimmed !== '') {
      const n = Number(trimmed);
      if (!Number.isFinite(n) || n < 0) {
        setQtyDraft(placement.quantity == null ? '' : String(placement.quantity));
        return;
      }
      next = Math.floor(n);
    }
    if (next === (placement.quantity ?? null)) return;
    updateM.mutate({
      collectionId,
      entityType,
      entityId,
      groupId: placement.groupId,
      patch: { quantity: next },
    });
  };

  const commitNote = () => {
    const trimmed = noteDraft.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next === (placement.note ?? null)) return;
    updateM.mutate({
      collectionId,
      entityType,
      entityId,
      groupId: placement.groupId,
      patch: { note: next },
    });
  };

  return (
    <div className="space-y-1">
      {showLabel && (
        <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
          {label}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Input
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
          placeholder="Qty"
          aria-label={`Quantity for ${label}`}
          className="border-border bg-card focus-visible:border-primary focus-visible:ring-primary/30 h-7 w-16 rounded-[8px] border-2 px-1.5 text-base tabular-nums focus-visible:outline-none focus-visible:ring-4 sm:text-[11px]"
        />
        <Input
          type="text"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setNoteDraft(placement.note ?? '');
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Note"
          aria-label={`Note for ${label}`}
          className="border-border bg-card focus-visible:border-primary focus-visible:ring-primary/30 h-7 min-w-0 flex-1 rounded-[8px] border-2 px-1.5 text-base focus-visible:outline-none focus-visible:ring-4 sm:text-[11px]"
        />
      </div>
    </div>
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
        'inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[11px] font-bold transition-colors',
        active
          ? 'bg-primary/15 border-primary/50 text-foreground'
          : 'border-border text-muted-foreground hover:text-foreground border-dashed',
      )}
    >
      {active ? (
        <Check className="h-2.5 w-2.5" aria-hidden />
      ) : (
        <Plus className="h-2.5 w-2.5" aria-hidden />
      )}
      <span className="max-w-[7rem] truncate">{label}</span>
    </button>
  );
}

function CollectionGlyph({ icon, color }: { icon: string | null; color: string | null }) {
  const { Icon } = resolveCollectionIcon(icon);
  const c = resolveCollectionColor(color);
  return (
    <span
      aria-hidden
      className={cn(
        'shadow-slot inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px]',
        c.iconBg,
        c.iconColor,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

/** Arrow on the panel's top edge, pointing at the middle of the trigger. */
function Notch({ trigger, panelLeft }: { trigger: HTMLElement | null; panelLeft: number }) {
  const r = trigger?.getBoundingClientRect();
  const x = r ? Math.max(14, r.left + r.width / 2 - panelLeft) : 22;
  return (
    <span
      aria-hidden
      className="border-border bg-card absolute -top-[7px] h-3 w-3 rotate-45 border-l-2 border-t-2"
      style={{ left: x - 6 }}
    />
  );
}
