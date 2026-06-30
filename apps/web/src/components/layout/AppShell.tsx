import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CommandPaletteHost } from '@/components/command-palette/CommandPaletteHost';
import { DataUpdatePrompt } from '@/components/data/DataUpdatePrompt';
import { DatasetAutoUpdate } from '@/components/dataset/DatasetAutoUpdate';
import { DatasetInstallScreen } from '@/components/dataset/DatasetInstallScreen';
import { AppBootScreen } from '@/components/layout/AppBootScreen';
import { Sidebar } from '@/components/layout/Sidebar';
import { StorageUnavailableScreen } from '@/components/layout/StorageUnavailableScreen';
import { TopBar } from '@/components/layout/TopBar';
import { Sheet, SheetContent, SheetTitle } from '@scrolled/ui';
import { useFeatures } from '@/hooks/useFeatures';
import { useDataState } from '@/hooks/useDataState';
import { useStorageHealth } from '@/hooks/useStorageHealth';
import { useSidebarLayout } from '@/stores/sidebarState';
import { useStorageBypass } from '@/stores/storageBypass';
import { appConfig } from '@/config';

export function AppShell() {
  const storage = useStorageHealth();
  const bypassed = useStorageBypass((s) => s.bypassed);

  // On-device storage failing outranks everything else: installing a dataset or
  // running setup into an in-memory engine just loses it on reload. Block until
  // it's resolved or the user knowingly bypasses it. Gated on `resolved` so the
  // boot screen below covers the brief window while status is still loading,
  // and threaded into the setup gate so its first-run redirect doesn't bounce
  // past this screen.
  const storageBlocked = storage.resolved && storage.unavailable && !bypassed;
  const { showBoot, needsInstall } = useSetupGate(storageBlocked);

  if (storageBlocked) return <StorageUnavailableScreen failures={storage.failures} />;
  if (needsInstall) return <DatasetInstallScreen />;
  if (showBoot) return <AppBootScreen />;
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <MobileSidebarDrawer />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="isolate">
          <div className="container py-4 max-md:px-2 md:py-4">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPaletteHost />
      <DataUpdatePrompt />
      <DatasetAutoUpdate />
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        aria-label="Navigation"
        className="bg-sidebar w-64 max-w-[85vw] md:hidden"
        overlayClassName="md:hidden"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Sidebar variant="mobile" />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Gate AppShell behind a boot screen while library status resolves, then bounce
 * first-run / rebuild users to the setup wizard. Covers two redirect cases:
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
 *
 * `showBoot` keeps the full shell hidden until redirect completes so first-time
 * visitors don't flash the home page chrome.
 */
function useSetupGate(storageBlocked: boolean): { showBoot: boolean; needsInstall: boolean } {
  const features = useFeatures();
  const { state, ready } = useDataState();
  const navigate = useNavigate();
  const location = useLocation();

  // The fixed-dataset deployment has no setup wizard to redirect to — when its
  // library is empty it installs the hosted dataset instead.
  const canImport = appConfig.features.enableUserImport;
  const onSetup = location.pathname === '/setup';
  // A broken on-device store makes both setup and install pointless (they'd
  // write into memory and vanish on reload), so the storage screen takes over.
  const shouldRedirect =
    canImport &&
    ready &&
    !onSetup &&
    !storageBlocked &&
    (state === 'reinitialize-required' || features.isFirstRun);
  // A fixed deployment has no setup wizard, so a library too old to read can't be
  // rebuilt in place — re-download the hosted dataset instead. Same screen as
  // first-run install; the importer replaces the whole DB, repopulating any new
  // columns/tables the bumped data revision introduced.
  const needsInstall =
    appConfig.features.enableHostedDataset &&
    ready &&
    !onSetup &&
    !storageBlocked &&
    (features.isFirstRun || state === 'reinitialize-required');
  const showBoot = !onSetup && !needsInstall && (!ready || shouldRedirect);

  useEffect(() => {
    if (!shouldRedirect) return;
    if (state === 'reinitialize-required') {
      navigate('/setup', { replace: true, state: { reason: 'data-incompatible' } });
    } else {
      navigate('/setup', { replace: true });
    }
  }, [shouldRedirect, state, navigate]);

  return { showBoot, needsInstall };
}
