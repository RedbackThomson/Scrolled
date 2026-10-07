import { useMemo, useState } from 'react';
import { ChevronRight, Loader2, Plus } from 'lucide-react';
import { cn, SearchPill } from '@scrolled/design';
import { useCollectionGroups, useCollectionsList } from '@/hooks/useCollections';
import type { CollectionGroup, CollectionRecord } from '@/db/user';
import { resolveCollectionColor } from './colorRegistry';
import { resolveCollectionIcon } from './iconRegistry';

interface CollectionDestinationPickerProps {
  /** Rows about to be added, for the heading */
  count: number;
  pending?: boolean;
  /** `group` is null for the collection's ungrouped list */
  onPick: (collection: CollectionRecord, group: CollectionGroup | null) => void;
  onNewCollection: () => void;
}

/** Choose where a set of rows goes: a collection, or one of its groups. */
export function CollectionDestinationPicker({
  count,
  pending,
  onPick,
  onNewCollection,
}: CollectionDestinationPickerProps) {
  const collectionsQ = useCollectionsList();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = collectionsQ.data ?? [];
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  }, [collectionsQ.data, query]);

  return (
    <div aria-busy={pending}>
      <div className="space-y-2 p-2.5 pb-2">
        <div className="font-display px-0.5 text-[15px] font-semibold">
          Add {count.toLocaleString()} to…
        </div>
        <SearchPill
          autoFocus
          tone="sunken"
          size="sm"
          width="100%"
          value={query}
          onChange={setQuery}
          placeholder="Find a collection…"
          aria-label="Find a collection"
        />
      </div>
      <ul className="border-muted max-h-72 space-y-0.5 overflow-y-auto border-t-2 p-1.5">
        {collectionsQ.isPending ? (
          <li className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading…
          </li>
        ) : visible.length === 0 ? (
          <li className="text-muted-foreground px-3 py-2 text-xs">
            {query.trim() ? 'No matches' : 'No collections yet.'}
          </li>
        ) : (
          visible.map((c) => (
            <DestinationRow
              key={c.id}
              collection={c}
              expanded={expanded === c.id}
              onExpand={() => setExpanded(expanded === c.id ? null : c.id)}
              disabled={pending}
              onPick={(group) => onPick(c, group)}
            />
          ))
        )}
      </ul>
      <div className="border-muted bg-muted rounded-b-[16px] border-t-2 p-1.5">
        <button
          type="button"
          onClick={onNewCollection}
          className="sc-focus-ring text-primary hover:bg-card flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] font-bold"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New collection…
        </button>
      </div>
    </div>
  );
}

function DestinationRow({
  collection,
  expanded,
  onExpand,
  disabled,
  onPick,
}: {
  collection: CollectionRecord;
  expanded: boolean;
  onExpand: () => void;
  disabled?: boolean;
  onPick: (group: CollectionGroup | null) => void;
}) {
  const groupsQ = useCollectionGroups(expanded ? collection.id : null);
  const color = resolveCollectionColor(collection.color);
  const { Icon } = resolveCollectionIcon(collection.icon);
  return (
    <li>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPick(null)}
          className="sc-focus-ring hover:bg-muted flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left disabled:opacity-60"
        >
          <span
            className={cn(
              'shadow-slot grid h-7 w-7 shrink-0 place-items-center rounded-[9px]',
              color.iconBg,
              color.iconColor,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">
            {collection.name}
          </span>
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {collection.memberCount.toLocaleString()}
          </span>
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={expanded}
          aria-label={`Groups in ${collection.name}`}
          title="Add to a group"
          className="sc-focus-ring text-muted-foreground hover:bg-muted hover:text-foreground grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        >
          <ChevronRight
            className={cn('ease-spring h-4 w-4 transition-transform duration-300', expanded && 'rotate-90')}
          />
        </button>
      </div>
      {expanded && (
        <ul className="bg-muted my-1 ml-9 mr-1 space-y-0.5 rounded-xl p-1 shadow-[0_0_0_2px_var(--accent-glow)]">
          {groupsQ.isPending ? (
            <li className="text-muted-foreground px-2.5 py-1.5 text-xs">Loading…</li>
          ) : (groupsQ.data ?? []).length === 0 ? (
            <li className="text-muted-foreground px-2.5 py-1.5 text-xs">No groups yet.</li>
          ) : (
            groupsQ.data!.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick(g)}
                  className="sc-focus-ring hover:bg-card flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold disabled:opacity-60"
                >
                  <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', color.swatch)} />
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </li>
  );
}
