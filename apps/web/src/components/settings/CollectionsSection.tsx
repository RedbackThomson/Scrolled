import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { useCollectionsList } from '@/hooks/useCollections';

export function CollectionsSection() {
  const sectionProps = useSettingsSection('collections');
  const collectionsQ = useCollectionsList();
  const collectionCount = collectionsQ.data?.length ?? 0;

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Collections</h2>
      </div>

      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <h3 className="text-sm font-semibold">Your collections</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          You have {collectionCount.toLocaleString()} collection{collectionCount === 1 ? '' : 's'}.
          Manage them, import from JSON, or export them on the{' '}
          <Link to="/collections" className="text-primary hover:underline">
            Collections page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
