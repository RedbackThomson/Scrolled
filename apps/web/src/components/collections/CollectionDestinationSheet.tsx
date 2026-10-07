import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Loader2, Plus } from 'lucide-react';
import { BottomSheet, Button, cn, SearchPill } from '@scrolled/design';
import { useCollectionGroups, useCollectionsList } from '@/hooks/useCollections';
import type { CollectionEntityType, CollectionGroup, CollectionRecord } from '@/db/user';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { resolveCollectionColor } from './colorRegistry';
import { resolveCollectionIcon } from './iconRegistry';

const PREVIEW = 3;

interface CollectionDestinationSheetProps {
  count: number;
  entity: CollectionEntityType;
  /** A few of the selected ids, for the stacked preview */
  previewIds: readonly number[];
  pending?: boolean;
  onAdd: (collection: CollectionRecord, group: CollectionGroup | null) => void;
  onNewCollection: () => void;
  onClose: () => void;
}

/** The phone sheet for choosing where selected rows go; a collection expands in place to its groups. */
export function CollectionDestinationSheet({
  count,
  entity,
  previewIds,
  pending,
  onAdd,
  onNewCollection,
  onClose,
}: CollectionDestinationSheetProps) {
  const collectionsQ = useCollectionsList();
  const [query, setQuery] = useState('');
  const [collection, setCollection] = useState<CollectionRecord | null>(null);
  const [group, setGroup] = useState<CollectionGroup | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = collectionsQ.data ?? [];
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  }, [collectionsQ.data, query]);

  const destination = group?.name ?? collection?.name;

  return createPortal(
    <BottomSheet
      label={`Add ${count} to a collection`}
      onDismiss={onClose}
      top={200}
      footer={
        <Button
          className="h-12 w-full rounded-2xl"
          disabled={!collection || pending}
          onClick={() => collection && onAdd(collection, group)}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {destination ? `Add to ${destination}` : 'Choose a collection'}
        </Button>
      }
    >
      <div className="space-y-3 px-4 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex">
            {previewIds.slice(0, PREVIEW).map((id, i) => (
              <span
                key={id}
                className="rounded-[12px] ring-2 ring-[var(--surface-card)]"
                style={{ marginLeft: i === 0 ? 0 : -12, zIndex: PREVIEW - i }}
              >
                <EntityAvatar entity={entity} id={id} size={40} />
              </span>
            ))}
          </div>
          <h2 className="font-display text-xl font-semibold">Add {count.toLocaleString()} to…</h2>
        </div>
        <SearchPill
          tone="sunken"
          size="lg"
          width="100%"
          value={query}
          onChange={setQuery}
          placeholder="Find a collection…"
          aria-label="Find a collection"
        />
        <ul className="space-y-1">
          {collectionsQ.isPending ? (
            <li className="text-muted-foreground flex items-center gap-2 px-2 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </li>
          ) : (
            visible.map((c) => (
              <SheetRow
                key={c.id}
                collection={c}
                expanded={collection?.id === c.id}
                group={collection?.id === c.id ? group : null}
                onPick={() => {
                  setCollection(collection?.id === c.id ? null : c);
                  setGroup(null);
                }}
                onGroup={setGroup}
              />
            ))
          )}
          <li>
            <button
              type="button"
              onClick={onNewCollection}
              className="sc-focus-ring border-border text-muted-foreground flex min-h-[54px] w-full items-center gap-3 rounded-2xl border-2 border-dashed px-3 text-[15px] font-bold"
            >
              <Plus className="h-4 w-4" />
              New collection
            </button>
          </li>
        </ul>
      </div>
    </BottomSheet>,
    document.body,
  );
}

function SheetRow({
  collection,
  expanded,
  group,
  onPick,
  onGroup,
}: {
  collection: CollectionRecord;
  expanded: boolean;
  group: CollectionGroup | null;
  onPick: () => void;
  onGroup: (group: CollectionGroup | null) => void;
}) {
  const groupsQ = useCollectionGroups(expanded ? collection.id : null);
  const color = resolveCollectionColor(collection.color);
  const { Icon } = resolveCollectionIcon(collection.icon);
  const groups = groupsQ.data ?? [];
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-expanded={expanded}
        className={cn(
          'sc-focus-ring flex min-h-[54px] w-full items-center gap-3 rounded-2xl px-2 text-left',
          expanded && 'bg-muted',
        )}
      >
        <span
          className={cn(
            'shadow-slot grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px]',
            color.iconBg,
            color.iconColor,
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{collection.name}</span>
        <span className="text-muted-foreground text-[13px] tabular-nums">
          {collection.memberCount.toLocaleString()}
        </span>
        <ChevronRight
          className={cn(
            'text-muted-foreground ease-spring h-4 w-4 transition-transform duration-300',
            expanded && 'rotate-90',
          )}
        />
      </button>
      {expanded && groups.length > 0 && (
        <div
          role="radiogroup"
          aria-label={`Groups in ${collection.name}`}
          className="bg-muted mx-1 mt-1 rounded-2xl p-1 shadow-[0_0_0_2px_var(--accent)]"
        >
          {[null, ...groups].map((g) => {
            const on = (group?.id ?? null) === (g?.id ?? null);
            return (
              <button
                key={g?.id ?? 'ungrouped'}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onGroup(g)}
                className="sc-focus-ring flex min-h-[46px] w-full items-center gap-2.5 rounded-xl px-3 text-left text-[14px] font-semibold"
              >
                <span
                  aria-hidden
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-full border-2',
                    on ? 'border-primary' : 'border-border',
                  )}
                >
                  {on && <span className="bg-primary h-2.5 w-2.5 rounded-full" />}
                </span>
                <span className={cn('h-2 w-2 shrink-0 rounded-full', g ? color.swatch : 'bg-border')} />
                <span className="min-w-0 flex-1 truncate">{g?.name ?? 'Not in a group'}</span>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
