import { BookmarkPlus, FolderPlus, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CommandGroup,
  CommandItem as CommandItemPrimitive,
} from '@/components/ui/command';
import {
  useCollectionsList,
  useCreateCollection,
  useToggleMembership,
} from '@/lib/useCollections';
import { useCommandPalette } from '@/lib/useCommandPalette';
import type { CollectionEntityType } from '@/db/user';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

function isCollectableEntity(entity?: string): entity is CollectionEntityType {
  return entity === 'item' || entity === 'equip' || entity === 'mob' ||
    entity === 'npc' || entity === 'map' || entity === 'quest';
}

/**
 * Read-only "add to existing collection" actions for the entity on the
 * active detail page. Sits near the top of the palette: a returning user
 * who opens the palette on a detail page is usually there to file the
 * entity into a list they've already created.
 */
export function CollectionsContextProvider() {
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const pageContext = useCommandPalette((s) => s.pageContext);

  const listQ = useCollectionsList();
  const toggleM = useToggleMembership();

  const entity = pageContext?.entity;
  const entityId = pageContext?.id;
  const onDetailPage = isCollectableEntity(entity) && typeof entityId === 'number';
  if (!onDetailPage || !entity) return null;

  const collections = listQ.data ?? [];
  const addItems = collections.filter((c) => fuzzy(query, `add to ${c.name}`));
  if (addItems.length === 0) return null;

  return (
    <CommandGroup heading="Add to collection">
      {addItems.map((c) => (
        <CommandItemPrimitive
          key={`coll-add-${c.id}`}
          value={`coll-add-${c.id}`}
          keywords={['add', c.name]}
          onSelect={async () => {
            await toggleM.mutateAsync({
              collectionId: c.id,
              entityType: entity,
              entityId: entityId!,
              member: true,
            });
            setOpen(false);
          }}
        >
          <BookmarkPlus className="text-muted-foreground h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">Add to {c.name}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            {c.memberCount}
          </span>
        </CommandItemPrimitive>
      ))}
    </CommandGroup>
  );
}

/**
 * "Create new collection with this entity" — a write that should rank
 * below search results. The user typed a name that didn't match any
 * existing collection (or any other result), so falling through to
 * create-new feels right.
 */
export function CollectionsCreateProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const pageContext = useCommandPalette((s) => s.pageContext);
  const toggleM = useToggleMembership();
  const createM = useCreateCollection();

  const entity = pageContext?.entity;
  const entityId = pageContext?.id;
  const entityName = pageContext?.name;
  const onDetailPage = isCollectableEntity(entity) && typeof entityId === 'number';

  const trimmed = query.trim();
  if (!onDetailPage || !entity || !trimmed || !entityName) return null;

  return (
    <CommandGroup heading="Create">
      <CommandItemPrimitive
        value="coll-create-with-current"
        keywords={['new', 'collection', 'create', trimmed]}
        onSelect={async () => {
          const created = await createM.mutateAsync({ name: trimmed });
          await toggleM.mutateAsync({
            collectionId: created.id,
            entityType: entity,
            entityId: entityId!,
            member: true,
          });
          navigate(`/collections/${created.id}`);
          setOpen(false);
        }}
      >
        <FolderPlus className="text-muted-foreground h-4 w-4" />
        <span className="min-w-0 flex-1 truncate">
          Create collection "<span className="font-medium">{trimmed}</span>" with this {entity}
        </span>
      </CommandItemPrimitive>
    </CommandGroup>
  );
}

/**
 * Plain "go to <collection>" navigation. Lower priority — sits with the
 * other static navigation entries, below search results.
 */
export function CollectionsNavigationProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);

  const listQ = useCollectionsList();
  const collections = listQ.data ?? [];

  const navItems = collections.filter((c) => fuzzy(query, c.name)).slice(0, 8);
  if (navItems.length === 0) return null;

  return (
    <CommandGroup heading="Collections">
      {navItems.map((c) => (
        <CommandItemPrimitive
          key={`coll-go-${c.id}`}
          value={`coll-go-${c.id}`}
          keywords={[c.name]}
          onSelect={() => {
            navigate(`/collections/${c.id}`);
            setOpen(false);
          }}
        >
          <Folder className="text-muted-foreground h-4 w-4" />
          <span className="min-w-0 flex-1 truncate">{c.name}</span>
          <span className="text-muted-foreground shrink-0 font-mono text-xs">
            {c.memberCount}
          </span>
        </CommandItemPrimitive>
      ))}
    </CommandGroup>
  );
}
