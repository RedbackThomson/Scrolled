import { LibraryStatusSection } from '@/components/settings/LibraryStatusSection';
import { GameDataSection } from '@/components/settings/GameDataSection';
import { BackupSection } from '@/components/settings/BackupSection';
import { ServerProfileSection } from '@/components/settings/ServerProfileSection';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { CollectionsSection } from '@/components/settings/CollectionsSection';

export default function SettingsIndex() {
  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Manage your library, appearance, and server preferences.
        </p>
      </header>

      <LibraryStatusSection />
      <AppearanceSection />
      <CollectionsSection />
      <GameDataSection />
      <BackupSection />
      <ServerProfileSection />
      <PrivacySection />
    </div>
  );
}
