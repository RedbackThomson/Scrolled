import { LibraryStatusSection } from '@/components/settings/LibraryStatusSection';
import { GameDataSection } from '@/components/settings/GameDataSection';
import { BackupSection } from '@/components/settings/BackupSection';
import { ServerProfileSection } from '@/components/settings/ServerProfileSection';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { CollectionsSection } from '@/components/settings/CollectionsSection';
import { BridgeSettingsPanel } from '@/mcp';
import { appConfig } from '@/config';

export default function SettingsIndex() {
  // Game Data (file management) and Server (profile) are import-only concerns —
  // on a fixed-dataset deployment the dataset is prebuilt and not user-editable.
  const canImport = appConfig.features.enableUserImport;

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {canImport
            ? 'Manage your library, appearance, and server preferences.'
            : 'Manage your appearance and preferences.'}
        </p>
      </header>

      <LibraryStatusSection />
      <AppearanceSection />
      <CollectionsSection />
      {canImport && <GameDataSection />}
      <BackupSection />
      {canImport && <ServerProfileSection />}
      <BridgeSettingsPanel />
      <PrivacySection />
    </div>
  );
}
