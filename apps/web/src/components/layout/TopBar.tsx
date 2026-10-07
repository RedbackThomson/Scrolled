import { ArrowLeft, Menu, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { AccountMenu } from '@/components/account/AccountMenu';
import { PaletteTrigger } from '@/components/command-palette/PaletteTrigger';
import { IconButton } from '@scrolled/design';
import { useSidebarLayout } from '@/stores/sidebarState';
import { appConfig } from '@/config';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useListChrome } from '@/stores/listChrome';

export function TopBar() {
  const setMobileOpen = useSidebarLayout((s) => s.setMobileOpen);
  const location = useLocation();
  const navigate = useNavigate();
  // React Router gives the entry page the key 'default', so a back button there
  // would leave the app instead of returning to a page in it.
  const canGoBack =
    location.key !== 'default' && location.pathname.split('/').filter(Boolean).length > 1;
  const isMobile = useIsMobile();
  const listSearch = useListChrome((s) => s.search);
  const listSelection = useListChrome((s) => s.selection);

  if (isMobile && listSelection) {
    const { count, total, allMatching, selectAll, exit } = listSelection;
    return (
      <header className="sticky top-0 z-10 flex h-[68px] items-center gap-3 px-2">
        <IconButton icon={X} variant="float" size={44} label="Stop selecting" onClick={exit} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="font-display text-[19px] font-semibold" aria-live="polite">
            {allMatching ? `All ${total.toLocaleString()} selected` : `${count.toLocaleString()} selected`}
          </span>
          {!allMatching && count < total && (
            <button
              type="button"
              onClick={selectAll}
              className="sc-focus-ring self-start rounded-md text-[13px] font-bold text-[color:var(--accent-text)]"
            >
              Select all {total.toLocaleString()}
            </button>
          )}
        </div>
      </header>
    );
  }

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
        {isMobile && listSearch ? (
          <button
            type="button"
            onClick={listSearch.open}
            className="bg-card text-muted-foreground shadow-float focus-visible:ring-primary/30 flex h-11 w-full items-center gap-2.5 rounded-full pl-4 pr-2 text-left focus-visible:outline-none focus-visible:ring-4"
          >
            <Search className="pointer-events-none h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{listSearch.placeholder}</span>
          </button>
        ) : (
          <PaletteTrigger />
        )}
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
