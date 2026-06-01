// Linear-backlog-style board for a collection's members.
//
// The shape of the board is driven by four display options the user
// picks in `CollectionDisplayOptionsMenu`:
//
//   grouping    — outer axis: 'none' | 'group' | 'type'
//   subgrouping — inner axis: 'none' | 'group' | 'type'
//   sortKey     — 'manual' | 'name' | 'added' | 'done' | 'quantity'
//   sortDir     — 'asc' | 'desc'
//
// Manual sort honors the DnD `position` column; any other sort orders
// from the named member field and disables drag-to-reorder (rows still
// render, just not draggable). Group reordering is only available when
// groups are the outer axis AND manual sort is active. Cross-type drags
// are disallowed whenever a `type` axis is in play, since an item's
// entity type is fixed.
//
// Drag is whole-row with a 5px PointerSensor distance so plain clicks
// still navigate; the "Create new group" dropzone only renders when
// groups are visible somewhere in the layout.

import { useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  COLLECTION_ENTITY_TYPES,
  type CollectionEntityType,
  type CollectionGroup,
  type CollectionGrouping,
  type CollectionMember,
  type CollectionRecord,
  type CollectionSortDir,
  type CollectionSortKey,
} from '@/db/user';
import {
  useCreateGroup,
  useMoveMember,
  useReorderGroups,
} from '@/hooks/useCollections';
import { useCollectionDisplay } from '@/stores/useCollectionDisplay';
import { GroupSection } from './GroupSection';
import { SortableMemberRow } from './SortableMemberRow';
import { NewGroupButton } from './NewGroupButton';
import {
  NEW_GROUP_DROPZONE_ID,
  groupDndId,
  memberDndId,
  parseGroupDndId,
  parseMemberDndId,
} from './dndIds';

const TYPE_LABELS: Record<CollectionEntityType, string> = {
  item: 'Items',
  equip: 'Equips',
  mob: 'Mobs',
  npc: 'NPCs',
  map: 'Maps',
  quest: 'Quests',
  questChain: 'Quest Chains',
  skill: 'Skills',
};

interface CollectionMembersBoardProps {
  collection: CollectionRecord;
  members: readonly CollectionMember[];
  groups: readonly CollectionGroup[];
  summaries: Record<CollectionEntityType, Map<number, string>> | undefined;
}

export function CollectionMembersBoard({
  collection,
  members,
  groups,
  summaries,
}: CollectionMembersBoardProps) {
  const collectionId = collection.id;
  const { display } = useCollectionDisplay(collection);
  const { grouping, subgrouping, sortKey, sortDir } = display;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const moveM = useMoveMember();
  const reorderGroupsM = useReorderGroups();
  const createGroupM = useCreateGroup();

  const [activeId, setActiveId] = useState<string | null>(null);

  // Subgrouping is meaningless when no outer grouping is set (collapse
  // it on the read side too so we don't accidentally render headers
  // for an inner axis the user can't see).
  const effectiveSub: CollectionGrouping = grouping === 'none' ? 'none' : subgrouping;

  // Two independent DnD modes:
  //   - Group reordering: always available when groups are the outer
  //     axis. The chosen item-sort affects only what's *inside* each
  //     group, so groups stay re-orderable even under name/added/etc.
  //   - Item reordering: only available under manual sort, since any
  //     other sort key implies the order is derived from a field.
  const groupReorderEnabled = grouping === 'group';
  const itemDragEnabled = sortKey === 'manual';
  const typeAxisActive = grouping === 'type' || effectiveSub === 'type';
  const groupsVisible = grouping === 'group' || effectiveSub === 'group';

  const groupNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const g of groups) map.set(g.id, g.name);
    return map;
  }, [groups]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };
  const onDragCancel = () => setActiveId(null);

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeKind = active.data.current?.kind as 'member' | 'group' | undefined;

    if (activeKind === 'group') {
      if (!groupReorderEnabled) return;
      const fromGid = parseGroupDndId(activeId);
      const toGid = parseGroupDndId(overId);
      // null = default group (can't move and can't be moved past in group-sort);
      // undefined = not a group id.
      if (fromGid == null || toGid == null) return;
      const ids = groups.map((g) => g.id);
      const fromIndex = ids.indexOf(fromGid);
      const toIndex = ids.indexOf(toGid);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
      const next = [...ids];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromGid);
      reorderGroupsM.mutate({ collectionId, orderedGroupIds: next });
      return;
    }

    if (activeKind !== 'member') return;
    if (!itemDragEnabled) return;
    const movingRef = parseMemberDndId(activeId);
    if (!movingRef) return;
    const moving = members.find(
      (m) => m.entityType === movingRef.entityType && m.entityId === movingRef.entityId,
    );
    if (!moving) return;

    if (overId === NEW_GROUP_DROPZONE_ID) {
      const name = nextDefaultGroupName(groups);
      const created = await createGroupM.mutateAsync({ collectionId, name });
      await moveM.mutateAsync({
        collectionId,
        entityType: moving.entityType,
        entityId: moving.entityId,
        targetGroupId: created.id,
        targetIndex: 0,
      });
      return;
    }

    // Drop on a group header → land at the start of that group.
    const overGroupId = parseGroupDndId(overId);
    if (overGroupId !== undefined) {
      await moveM.mutateAsync({
        collectionId,
        entityType: moving.entityType,
        entityId: moving.entityId,
        targetGroupId: overGroupId,
        targetIndex: 0,
      });
      return;
    }

    // Drop on another member → slot in at over's global-bucket index.
    const overRef = parseMemberDndId(overId);
    if (!overRef) return;
    const overMember = members.find(
      (m) => m.entityType === overRef.entityType && m.entityId === overRef.entityId,
    );
    if (!overMember) return;

    // Cross-type drags are not allowed when a type axis is in play —
    // an item's entity type is fixed, so the user's drag implies a
    // group / order change, not a retype.
    if (typeAxisActive && moving.entityType !== overMember.entityType) return;

    // Without a group axis there's no group to move *into*; preserve
    // the source group and only reorder within it.
    const targetGroupId = groupsVisible ? overMember.groupId : moving.groupId;

    // moveMember operates on the global (collection, group) bucket; the
    // target index is the over row's position in that global bucket
    // before parking. dnd-kit's redensify+shiftUp then lands the row
    // exactly where the sortable preview showed it.
    const globalBucket = members
      .filter((m) => (m.groupId ?? null) === (targetGroupId ?? null))
      .slice()
      .sort((a, b) => a.position - b.position);
    const overGlobalIndex = globalBucket.findIndex(
      (m) => m.entityType === overMember.entityType && m.entityId === overMember.entityId,
    );
    const targetIndex = overGlobalIndex < 0 ? globalBucket.length : overGlobalIndex;

    await moveM.mutateAsync({
      collectionId,
      entityType: moving.entityType,
      entityId: moving.entityId,
      targetGroupId,
      targetIndex,
    });
  };

  const isDragging = activeId != null;

  // Pre-compute the outer / inner buckets so render is a pure walk.
  const tree = useMemo(
    () =>
      buildTree({
        members,
        groups,
        grouping,
        subgrouping: effectiveSub,
        sortKey,
        sortDir,
        summaries,
      }),
    [members, groups, grouping, effectiveSub, sortKey, sortDir, summaries],
  );

  const outerSortableIds = useMemo(() => {
    if (!groupReorderEnabled) return [];
    const ids: string[] = [];
    for (const outer of tree) {
      if (outer.kind === 'group') ids.push(groupDndId(outer.groupId));
    }
    return ids;
  }, [tree, groupReorderEnabled]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={outerSortableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-6">
          {tree.map((outer) => (
            <OuterSection
              key={outer.key}
              outer={outer}
              itemDragEnabled={itemDragEnabled}
              groupReorderEnabled={groupReorderEnabled}
              groupNameById={groupNameById}
              summaries={summaries}
            />
          ))}
        </div>
      </SortableContext>
      {groupsVisible && (
        <NewGroupButton
          isDragging={isDragging}
          acceptDrops={itemDragEnabled}
          onClick={async () => {
            const name = promptForGroupName(groups);
            if (!name) return;
            await createGroupM.mutateAsync({ collectionId, name });
          }}
        />
      )}
    </DndContext>
  );
}

function promptForGroupName(groups: readonly CollectionGroup[]): string | null {
  const taken = new Set(groups.map((g) => g.name));
  let suggestion = 'New group';
  for (let i = 2; i < 1000 && taken.has(suggestion); i++) {
    suggestion = `New group ${i}`;
  }
  const raw = window.prompt('Name this group:', suggestion);
  if (raw == null) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// -- tree --------------------------------------------------------------------

interface InnerBucket {
  /** Stable per-render key for React. */
  key: string;
  /** Sub-header for the inner bucket, or null to render headerless. */
  header: { label: string; count: number } | null;
  members: CollectionMember[];
}

type OuterBucket =
  | {
      kind: 'group';
      key: string;
      groupId: number | null; // null = default
      name: string;
      count: number;
      /** Hide chrome when the only outer bucket is the default group. */
      showHeader: boolean;
      inner: InnerBucket[];
    }
  | {
      kind: 'type';
      key: string;
      entityType: CollectionEntityType;
      count: number;
      showHeader: boolean;
      inner: InnerBucket[];
    }
  | {
      kind: 'flat';
      key: string;
      count: number;
      inner: InnerBucket[];
    };

function buildTree({
  members,
  groups,
  grouping,
  subgrouping,
  sortKey,
  sortDir,
  summaries,
}: {
  members: readonly CollectionMember[];
  groups: readonly CollectionGroup[];
  grouping: CollectionGrouping;
  subgrouping: CollectionGrouping;
  sortKey: CollectionSortKey;
  sortDir: CollectionSortDir;
  summaries: Record<CollectionEntityType, Map<number, string>> | undefined;
}): OuterBucket[] {
  const groupOrder = groups.map((g) => g.id);
  const groupNameById = new Map<number, string>();
  for (const g of groups) groupNameById.set(g.id, g.name);

  const sortLeaf = (list: CollectionMember[]) =>
    applySort(list, sortKey, sortDir, summaries);

  const buildInner = (slice: CollectionMember[]): InnerBucket[] => {
    if (subgrouping === 'none') {
      return [{ key: 'all', header: null, members: sortLeaf(slice) }];
    }
    if (subgrouping === 'group') {
      const buckets: InnerBucket[] = [];
      for (const gid of groupOrder) {
        const m = slice.filter((x) => x.groupId === gid);
        if (m.length === 0) continue;
        buckets.push({
          key: `g-${gid}`,
          header: { label: groupNameById.get(gid) ?? '', count: m.length },
          members: sortLeaf(m),
        });
      }
      const def = slice.filter((x) => x.groupId == null);
      if (def.length > 0) {
        buckets.push({
          key: 'g-default',
          header: { label: 'Ungrouped', count: def.length },
          members: sortLeaf(def),
        });
      }
      return buckets;
    }
    // subgrouping === 'type'
    const buckets: InnerBucket[] = [];
    for (const t of COLLECTION_ENTITY_TYPES) {
      const m = slice.filter((x) => x.entityType === t);
      if (m.length === 0) continue;
      buckets.push({
        key: `t-${t}`,
        header: { label: TYPE_LABELS[t], count: m.length },
        members: sortLeaf(m),
      });
    }
    return buckets;
  };

  if (grouping === 'none') {
    return [
      {
        kind: 'flat',
        key: 'flat',
        count: members.length,
        inner: buildInner(members.slice()),
      },
    ];
  }

  if (grouping === 'group') {
    const out: OuterBucket[] = [];
    for (const g of groups) {
      const slice = members.filter((m) => m.groupId === g.id);
      if (slice.length === 0 && subgrouping !== 'none') {
        // Empty user-group still renders so it can be a drop target
        // (and so the user can see groups they've created but not yet
        // populated). Same in sub='none' branch below.
      }
      out.push({
        kind: 'group',
        key: `g-${g.id}`,
        groupId: g.id,
        name: g.name,
        count: slice.length,
        showHeader: true,
        inner: buildInner(slice),
      });
    }
    const def = members.filter((m) => m.groupId == null);
    const hasUserGroups = groups.length > 0;
    if (def.length > 0 || hasUserGroups) {
      // Only render the default bucket when it has members; an empty
      // default-bucket-header on a fully-grouped collection adds noise.
      if (def.length > 0) {
        out.push({
          kind: 'group',
          key: 'g-default',
          groupId: null,
          name: 'Ungrouped',
          count: def.length,
          showHeader: hasUserGroups,
          inner: buildInner(def),
        });
      }
    }
    return out;
  }

  // grouping === 'type'
  const out: OuterBucket[] = [];
  for (const t of COLLECTION_ENTITY_TYPES) {
    const slice = members.filter((m) => m.entityType === t);
    if (slice.length === 0) continue;
    out.push({
      kind: 'type',
      key: `t-${t}`,
      entityType: t,
      count: slice.length,
      showHeader: true,
      inner: buildInner(slice),
    });
  }
  return out;
}

function applySort(
  members: readonly CollectionMember[],
  key: CollectionSortKey,
  dir: CollectionSortDir,
  summaries: Record<CollectionEntityType, Map<number, string>> | undefined,
): CollectionMember[] {
  const sorted = members.slice();
  const nameOf = (m: CollectionMember) =>
    summaries?.[m.entityType]?.get(m.entityId) ?? '';
  switch (key) {
    case 'manual':
      sorted.sort((a, b) => a.position - b.position);
      break;
    case 'name':
      sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      break;
    case 'added':
      sorted.sort((a, b) => a.addedAt - b.addedAt);
      break;
    case 'done':
      sorted.sort((a, b) => Number(a.done) - Number(b.done));
      break;
    case 'quantity':
      sorted.sort((a, b) => (a.quantity ?? -1) - (b.quantity ?? -1));
      break;
  }
  if (dir === 'desc') sorted.reverse();
  return sorted;
}

// -- rendering ---------------------------------------------------------------

function OuterSection({
  outer,
  itemDragEnabled,
  groupReorderEnabled,
  groupNameById: _groupNameById,
  summaries,
}: {
  outer: OuterBucket;
  itemDragEnabled: boolean;
  groupReorderEnabled: boolean;
  groupNameById: Map<number, string>;
  summaries: Record<CollectionEntityType, Map<number, string>> | undefined;
}) {
  if (outer.kind === 'flat') {
    return (
      <div className="space-y-3">
        {outer.inner.map((inner) => (
          <InnerSection
            key={inner.key}
            inner={inner}
            itemDragEnabled={itemDragEnabled}
            summaries={summaries}
          />
        ))}
      </div>
    );
  }

  if (outer.kind === 'group') {
    return (
      <GroupSection
        groupId={outer.groupId}
        name={outer.name}
        count={outer.count}
        showHeader={outer.showHeader}
        draggable={groupReorderEnabled && outer.groupId != null}
      >
        <div className="space-y-3">
          {outer.inner.map((inner) => (
            <InnerSection
              key={inner.key}
              inner={inner}
              itemDragEnabled={itemDragEnabled}
              summaries={summaries}
            />
          ))}
        </div>
      </GroupSection>
    );
  }

  // 'type'
  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
        {TYPE_LABELS[outer.entityType]} ({outer.count})
      </h2>
      <div className="space-y-3">
        {outer.inner.map((inner) => (
          <InnerSection
            key={inner.key}
            inner={inner}
            itemDragEnabled={itemDragEnabled}
            summaries={summaries}
          />
        ))}
      </div>
    </section>
  );
}

function InnerSection({
  inner,
  itemDragEnabled,
  summaries,
}: {
  inner: InnerBucket;
  itemDragEnabled: boolean;
  summaries: Record<CollectionEntityType, Map<number, string>> | undefined;
}) {
  return (
    <div className="space-y-1">
      {inner.header && (
        <div className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
          {inner.header.label} ({inner.header.count})
        </div>
      )}
      <SortableContext
        items={inner.members.map((m) => memberDndId(m.entityType, m.entityId))}
        strategy={verticalListSortingStrategy}
        disabled={!itemDragEnabled}
      >
        <div className="border-border bg-card text-card-foreground divide-border divide-y rounded-md border">
          {inner.members.map((m) => (
            <SortableMemberRow
              key={`${m.entityType}-${m.entityId}`}
              member={m}
              name={summaries?.[m.entityType]?.get(m.entityId) ?? null}
              disabled={!itemDragEnabled}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// -- helpers ----------------------------------------------------------------

function nextDefaultGroupName(groups: readonly CollectionGroup[]): string {
  const taken = new Set(groups.map((g) => g.name));
  if (!taken.has('New group')) return 'New group';
  for (let i = 2; i < 1000; i++) {
    const candidate = `New group ${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `New group ${taken.size + 1}`;
}
