import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollectionFormDialog } from '@/components/collections';
import { useCollectionsList } from '@/lib/useCollections';
import type { CollectionRecord } from '@/db/user';

export default function Collections() {
  const collectionsQ = useCollectionsList();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Saved lists of items, mobs, maps, and quests. Stored locally in a separate database
            from your loaded game data — they survive WZ re-imports.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New collection
        </Button>
      </header>

      <CollectionFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <section className="space-y-3">
        {collectionsQ.isPending ? (
          <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </p>
        ) : collectionsQ.isError ? (
          <p className="text-destructive text-sm">
            Failed to load collections: {(collectionsQ.error as Error).message}
          </p>
        ) : collectionsQ.data!.length === 0 ? (
          <div className="border-border bg-muted/40 rounded-md border p-6 text-center text-sm">
            <p className="text-muted-foreground">
              No collections yet. Click "New collection" to create one, or open any item, mob, or
              map page and click "Save".
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {collectionsQ.data!.map((c) => (
              <CollectionTile key={c.id} collection={c} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CollectionTile({ collection }: { collection: CollectionRecord }) {
  return (
    <li>
      <Link
        to={`/collections/${collection.id}`}
        className="border-border bg-card text-card-foreground hover:border-foreground/30 group flex items-start gap-3 rounded-md border p-4 transition-colors"
      >
        <Bookmark className="text-muted-foreground group-hover:text-foreground mt-0.5 h-5 w-5 shrink-0 transition-colors" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="truncate text-sm font-semibold">{collection.name}</div>
          <div className="text-muted-foreground font-mono text-xs">
            {collection.memberCount.toLocaleString()}{' '}
            {collection.memberCount === 1 ? 'item' : 'items'}
          </div>
          {collection.description && (
            <p className="text-muted-foreground line-clamp-2 text-xs leading-snug">
              {collection.description}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
