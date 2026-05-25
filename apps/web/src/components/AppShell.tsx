import { useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Palette } from '@/components/command-palette/Palette';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useFeatures } from '@/lib/useFeatures';
import { useSidebarLayout } from '@/lib/sidebarState';

export function AppShell() {
  useFirstRunRedirect();
  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <MobileSidebarDrawer />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="container py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <Palette />
    </div>
  );
}

/**
 * Mobile-only slide-in nav drawer. Auto-closes on route change so tapping a
 * nav link doesn't strand the user on the new page with the drawer still
 * covering it.
 */
function MobileSidebarDrawer() {
  const open = useSidebarLayout((s) => s.mobileOpen);
  const setOpen = useSidebarLayout((s) => s.setMobileOpen);
  const location = useLocation();
  useEffect(() => {
    if (open) setOpen(false);
    // Intentionally only depends on the URL — closing on every URL change is
    // the desired behavior, regardless of whether `open` was true at render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/50 md:hidden" />
        <DialogPrimitive.Content
          aria-label="Navigation"
          className="bg-sidebar data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col shadow-xl outline-none md:hidden"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close navigation menu"
            className="text-sidebar-muted hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
          <Sidebar variant="mobile" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Bounce first-time visitors to the setup wizard. A "first run" is defined
 * as: features hook has loaded AND no datasets have ever been recorded AND
 * every entity table is empty. The wizard's recordDataset call flips this
 * off before the user navigates away.
 *
 * `isFetching` gate: the wizard invalidates the db queries after
 * `recordDataset`, but no observers are mounted while the wizard is up.
 * When the user clicks "Go Explore", AppShell remounts and the queries
 * synchronously serve their stale pre-extraction data (datasets=0) while
 * a refetch is in flight — without this gate we'd redirect right back to
 * /setup based on that stale snapshot.
 */
function useFirstRunRedirect(): void {
  const features = useFeatures();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!features.ready) return;
    if (features.isFetching) return;
    if (!features.isFirstRun) return;
    if (location.pathname === '/setup') return;
    navigate('/setup', { replace: true });
  }, [features.ready, features.isFetching, features.isFirstRun, location.pathname, navigate]);
}
