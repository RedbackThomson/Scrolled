import type { ComponentType } from 'react';
import { AccountSection } from '@/components/account/AccountSection';
import { AppearanceSection } from '@/components/settings/AppearanceSection';
import { BackupSection } from '@/components/settings/BackupSection';
import { CollectionsSection } from '@/components/settings/CollectionsSection';
import { CustomizationSection } from '@/components/settings/CustomizationSection';
import { GameDataSection } from '@/components/settings/GameDataSection';
import { LibraryStatusSection } from '@/components/settings/LibraryStatusSection';
import { PrivacySection } from '@/components/settings/PrivacySection';
import { ServerProfileSection } from '@/components/settings/ServerProfileSection';
import { BridgeSettingsPanel } from '@/mcp';

/** Section id (see settingsGroups) → the component that renders it. */
export const SETTINGS_SECTIONS: Record<string, ComponentType> = {
  'library-status': LibraryStatusSection,
  'game-data': GameDataSection,
  'import-export': BackupSection,
  server: ServerProfileSection,
  appearance: AppearanceSection,
  customization: CustomizationSection,
  collections: CollectionsSection,
  account: AccountSection,
  mcp: BridgeSettingsPanel,
  privacy: PrivacySection,
};
