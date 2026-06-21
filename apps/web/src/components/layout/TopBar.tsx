import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { AccountMenu } from '@/components/account/AccountMenu';
import { PaletteTrigger } from '@/components/command-palette/PaletteTrigger';
import { Button } from '@/components/ui/button';
import { useSidebarLayout } from '@/stores/sidebarState';
import { appConfig } from '@/config';

export function TopBar() {
  const location = useLocation();
  const setMobileOpen = useSidebarLayout((s) => s.setMobileOpen);
  const setSettingsNavOpen = useSidebarLayout((s) => s.setSettingsNavOpen);
  const onSettingsRoute = location.pathname.startsWith('/settings');

  return (
    <header className="border-border bg-background sticky top-0 z-10 flex h-14 items-center gap-2 border-b px-2 sm:px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label={onSettingsRoute ? 'Open settings menu' : 'Open navigation menu'}
        onClick={() =>
          onSettingsRoute ? setSettingsNavOpen(true) : setMobileOpen(true)
        }
      >
        <Menu className="h-4 w-4" />
      </Button>
      <div className="max-w-xl flex-1">
        <PaletteTrigger />
      </div>
      <div className="hidden flex-1 md:block" />
      <ThemeToggle />
      {appConfig.features.accountMenu && <AccountMenu />}
    </header>
  );
}
