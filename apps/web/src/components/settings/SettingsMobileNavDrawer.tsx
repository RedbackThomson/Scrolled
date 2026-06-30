import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { SettingsNavList } from '@/components/settings/SettingsSectionNav';
import { Sheet, SheetContent, SheetTitle } from '@scrolled/ui';
import { useSidebarLayout } from '@/stores/sidebarState';

export function SettingsMobileNavDrawer() {
  const open = useSidebarLayout((s) => s.settingsNavOpen);
  const setOpen = useSidebarLayout((s) => s.setSettingsNavOpen);
  const location = useLocation();

  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        aria-label="Settings menu"
        className="bg-sidebar text-sidebar-foreground w-64 max-w-[85vw] md:hidden"
        overlayClassName="md:hidden"
      >
        <SheetTitle className="sr-only">Settings menu</SheetTitle>
        <div className="border-border flex h-14 items-center border-b px-2">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="text-sidebar-muted hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to app
          </Link>
        </div>
        <div className="p-3">
          <SettingsNavList onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
