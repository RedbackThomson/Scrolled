import { useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Palette } from '@/components/command-palette/Palette';
import { DataUpdatePrompt } from '@/components/DataUpdatePrompt';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useFeatures } from '@/hooks/useFeatures';
import { useDataState } from '@/hooks/useDataState';
import { useSidebarLayout } from '@/stores/sidebarState';

export function AppShell() {
  useSetupRedirect();
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
      <DataUpdatePrompt />
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
 * Bounce users to the setup wizard when there's nothing to show, covering two
 * cases with one redirect:
 *
 *   - **Rebuild needed**: an incompatible cache was destructively cleared on
 *     open (`reinitialize-required`). We pass `state.reason` so the wizard
 *     explains *why* — otherwise the redirect looks like the app is broken.
 *   - **First run**: no data has ever been loaded. Plain redirect, no banner.
 *
 * Rebuild takes precedence: a just-cleared library looks empty (first-run) too,
 * but the user needs the explanation.
 *
 * `isFetching` gate (inside `useDataState.ready`): the wizard invalidates the
 * db queries after `recordDataset`, but no observers are mounted while the
 * wizard is up. When the user clicks "Go Explore", AppShell remounts and the
 * queries synchronously serve their stale pre-extraction snapshot while a
 * refetch is in flight — without the gate we'd redirect right back to /setup.
 */
function useSetupRedirect(): void {
  const features = useFeatures();
  const { state, ready } = useDataState();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!ready) return;
    if (location.pathname === '/setup') return;
    if (state === 'reinitialize-required') {
      navigate('/setup', { replace: true, state: { reason: 'data-incompatible' } });
    } else if (features.isFirstRun) {
      navigate('/setup', { replace: true });
    }
  }, [ready, state, features.isFirstRun, location.pathname, navigate]);
}
