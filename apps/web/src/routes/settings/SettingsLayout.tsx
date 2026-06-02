import { SettingsMobileNavDrawer } from '@/components/settings/SettingsMobileNavDrawer';
import { SettingsScrollSpyProvider } from '@/components/settings/SettingsScrollSpy';
import { SettingsSectionNav } from '@/components/settings/SettingsSectionNav';
import { Outlet } from 'react-router-dom';

export default function SettingsLayout() {
  return (
    <SettingsScrollSpyProvider>
      <SettingsMobileNavDrawer />
      <div className="flex gap-10">
        <SettingsSectionNav />
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </SettingsScrollSpyProvider>
  );
}
