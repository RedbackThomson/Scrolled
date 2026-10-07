import { Link } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/useSettingsSection';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsSection';
import { useCollectionsList } from '@/hooks/useCollections';

export function CollectionsSection() {
  const sectionProps = useSettingsSection('collections');
  const collectionsQ = useCollectionsList();
  const collectionCount = collectionsQ.data?.length ?? 0;

  return (
    <SettingsSection {...sectionProps} icon={Bookmark} title="Collections">
      <SettingsCard gap={0}>
        <h3 className="text-sm font-semibold">Your collections</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          You have {collectionCount.toLocaleString()} collection{collectionCount === 1 ? '' : 's'}.
          Manage them, import from JSON, or export them on the{' '}
          <Link to="/collections" className="text-primary hover:underline">
            Collections page
          </Link>
          .
        </p>
      </SettingsCard>
    </SettingsSection>
  );
}
