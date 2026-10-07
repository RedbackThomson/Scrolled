import { ArrowLeft, Menu } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { AccountMenu } from '@/components/account/AccountMenu';
import { PaletteTrigger } from '@/components/command-palette/PaletteTrigger';
import { IconButton } from '@scrolled/design';
import { useSidebarLayout } from '@/stores/sidebarState';
import { appConfig } from '@/config';

export function TopBar() {
  const setMobileOpen = useSidebarLayout((s) => s.setMobileOpen);
  const location = useLocation();
  const navigate = useNavigate();
  // React Router gives the entry page the key 'default', so a back button there
  // would leave the app instead of returning to a page in it.
  const canGoBack =
    location.key !== 'default' && location.pathname.split('/').filter(Boolean).length > 1;

  return (
    // The bar has no fill, so let clicks fall through the gaps between its
    // floating controls to the page scrolling beneath.
    <header className="pointer-events-none sticky top-0 z-10 flex h-[68px] items-center gap-3 pl-3 pr-6 max-md:gap-2 max-md:px-2 [&>*]:pointer-events-auto">
      {canGoBack && (
        <span className="md:hidden">
          <IconButton
            icon={ArrowLeft}
            variant="float"
            size={44}
            label="Go back"
            onClick={() => navigate(-1)}
          />
        </span>
      )}
      <span className="md:hidden">
        <IconButton
          icon={Menu}
          variant="float"
          size={44}
          label="Open navigation menu"
          onClick={() => setMobileOpen(true)}
        />
      </span>
      <div className="max-w-[520px] flex-1 max-md:max-w-none">
        <PaletteTrigger />
      </div>
      <div className="hidden flex-1 md:block" />
      {/* Theme lives in Settings and the palette on phones, leaving the search pill room. */}
      <span className="flex max-md:hidden">
        <ThemeToggle />
      </span>
      {appConfig.features.accountMenu && <AccountMenu />}
    </header>
  );
}
