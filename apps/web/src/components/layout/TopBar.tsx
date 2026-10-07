import { Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { AccountMenu } from '@/components/account/AccountMenu';
import { PaletteTrigger } from '@/components/command-palette/PaletteTrigger';
import { IconButton } from '@scrolled/design';
import { useSidebarLayout } from '@/stores/sidebarState';
import { appConfig } from '@/config';

export function TopBar() {
  const setMobileOpen = useSidebarLayout((s) => s.setMobileOpen);

  return (
    // The bar has no fill, so let clicks fall through the gaps between its
    // floating controls to the page scrolling beneath.
    <header className="pointer-events-none sticky top-0 z-10 flex h-[68px] items-center gap-3 pl-3 pr-6 max-md:px-2 [&>*]:pointer-events-auto">
      <span className="md:hidden">
        <IconButton
          icon={Menu}
          variant="float"
          size={40}
          label="Open navigation menu"
          onClick={() => setMobileOpen(true)}
        />
      </span>
      <div className="max-w-[520px] flex-1">
        <PaletteTrigger />
      </div>
      <div className="hidden flex-1 md:block" />
      <ThemeToggle />
      {appConfig.features.accountMenu && <AccountMenu />}
    </header>
  );
}
