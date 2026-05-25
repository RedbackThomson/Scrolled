import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Palette } from '@/components/command-palette/Palette';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useFeatures } from '@/lib/useFeatures';

export function AppShell() {
  useFirstRunRedirect();
  return (
    <div className="flex h-full w-full">
      <Sidebar />
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
  }, [
    features.ready,
    features.isFetching,
    features.isFirstRun,
    location.pathname,
    navigate,
  ]);
}
