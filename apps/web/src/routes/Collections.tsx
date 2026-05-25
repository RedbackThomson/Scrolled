import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Loader2, Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CollectionFormDialog,
  CollectionsImportDialog,
  downloadJson,
  resolveCollectionColor,
  resolveCollectionIcon,
  todayStamp,
} from '@/components/collections';
import { useCollectionsList, useExportAllJson } from '@/lib/useCollections';
import type { CollectionRecord } from '@/db/user';
import { cn } from '@/lib/utils';

export default function Collections() {
  const collectionsQ = useCollectionsList();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const exportAllM = useExportAllJson();

  const onExportAll = async () => {
    const payload = await exportAllM.mutateAsync();
    downloadJson(`collections-${todayStamp()}.json`, payload);
  };

  const hasAny = (collectionsQ.data?.length ?? 0) > 0;

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Collections</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Bookmarked lists for tracking anything across the app.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportAll}
            disabled={!hasAny || exportAllM.isPending}
            title={hasAny ? 'Export all collections as JSON' : 'No collections to export yet'}
          >
            {exportAllM.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export all
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New collection
          </Button>
        </div>
      </header>

      <CollectionFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <CollectionsImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      {exportAllM.isError && (
        <p className="text-destructive text-sm">
          Export failed: {(exportAllM.error as Error).message}
        </p>
      )}

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
              No collections yet. Click "New collection" to create one, "Import" to restore from a
              previous export, or save items directly from any entity page.
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
  const { Icon } = resolveCollectionIcon(collection.icon);
  const color = resolveCollectionColor(collection.color);
  return (
    <li>
      <Link
        to={`/collections/${collection.id}`}
        className="border-border bg-card text-card-foreground hover:border-foreground/30 group flex items-start gap-3 rounded-md border p-4 transition-colors"
      >
        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            color.iconBg,
            color.iconColor,
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
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
