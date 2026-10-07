// Home page — the launching pad a returning user lands on.
//
// First-run users see a single "Welcome" tile that points them at /setup;
// once they've loaded data the page becomes a hub composed of small
// self-gating widgets defined under `components/home/`. The order and
// visibility of those widgets are user-editable (Edit / Done button) and
// persisted to the user DB so the layout rides backup/restore.

import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutDashboard, Pencil, Sparkles } from 'lucide-react';
import { Banner, Button } from '@scrolled/design';
import {
  BrowseTiles,
  ContinueStrip,
  HomeSectionProvider,
  LibraryStats,
  MapsByRegion,
  PinnedCollectionsPanel,
  PinnedSearchesRow,
} from '@/components/home';
import { useHomeLayout } from '@/components/home/useHomeLayout';
import type { HomeSectionId } from '@/components/home/layout';
import { useFeatures, type Features } from '@/hooks/useFeatures';
import { useInstalledDataset } from '@/hooks/dataset/useInstalledDataset';
import { usePageTitle } from '@/hooks/usePageTitle';
import { appConfig } from '@/config';

const HomeEditor = lazy(() =>
  import('@/components/home/HomeEditor').then((m) => ({ default: m.HomeEditor })),
);

export default function Home() {
  usePageTitle();
  const features = useFeatures();
  const layout = useHomeLayout();
  const hostedName = useInstalledDataset()?.displayName ?? null;
  const [editing, setEditing] = useState(false);

  if (!features.ready) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-display text-4xl font-semibold leading-none">Scrolled</h1>
        <p className="text-muted-foreground mt-2 text-sm">Loading…</p>
      </div>
    );
  }

  if (!features.hasAny) {
    return <Welcome />;
  }

  const renderSection = (id: HomeSectionId): ReactNode => sectionContent(id, features);

  return (
    <div className="max-w-5xl space-y-8">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold leading-none">Scrolled</h1>
          {hostedName && (
            <p className="text-muted-foreground mt-1 truncate text-sm">{hostedName}</p>
          )}
        </div>
        {!editing && (
          <Button
            type="button"
            variant="secondary"
            icon={Pencil}
            onClick={() => setEditing(true)}
            title="Edit dashboard"
          >
            Edit
          </Button>
        )}
      </header>

      {editing ? (
        <HomeSectionProvider editing>
          <div className="space-y-3">
            <Banner
              tone="dark"
              icon={LayoutDashboard}
              title="Editing your home page. Drag sections to reorder, or hide what you don't use."
              action={
                // Re-points the surface tokens so the buttons read correctly on the dark banner.
                <div data-surface="tooltip" className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void layout.reset()}
                  >
                    Reset
                  </Button>
                  <Button type="button" size="sm" onClick={() => setEditing(false)}>
                    Done
                  </Button>
                </div>
              }
            />
            <Suspense fallback={<HomeSectionPlaceholder label="Editor" />}>
              <HomeEditor layout={layout} renderSection={renderSection} />
            </Suspense>
          </div>
        </HomeSectionProvider>
      ) : (
        <div className="space-y-8">
          {layout.entries
            .filter((e) => e.visible)
            .map((e) => (
              <div key={e.id}>{renderSection(e.id)}</div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Single registry mapping a section id to its rendered widget. Adding
 *  a new section means adding an entry here and in `HOME_SECTION_IDS`
 *  (and its label). The widgets self-gate on `features`, so this
 *  switch only handles dispatch. */
function sectionContent(id: HomeSectionId, features: Features): ReactNode {
  switch (id) {
    case 'continue':
      return <ContinueStrip />;
    case 'pinned-collections':
      return <PinnedCollectionsPanel />;
    case 'pinned-searches':
      return <PinnedSearchesRow />;
    case 'browse':
      return <BrowseTiles features={features} />;
    case 'regions':
      return <MapsByRegion features={features} />;
    case 'library':
      return <LibraryStats features={features} />;
  }
}

function HomeSectionPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="border-border bg-muted h-48 animate-pulse rounded-lg border-2"
      aria-busy
      aria-label={`Loading ${label}`}
    />
  );
}

function Welcome() {
  // On a fixed-dataset deployment the user never loads files; the library
  // arrives via the install flow (Phase 3), so there's nothing to point at here.
  if (!appConfig.features.enableUserImport) {
    return (
      <div className="max-w-3xl space-y-6">
        <header>
          <h1 className="font-display text-4xl font-semibold leading-none">Welcome</h1>
          <p className="text-muted-foreground mt-2 text-sm">Preparing your library…</p>
        </header>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-4xl font-semibold leading-none">Welcome</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A personal wiki that adapts to your version of the Mushroom Game. Load your game files to
          fill it in.
        </p>
      </header>
      <Link
        to="/setup"
        className="text-primary-foreground ease-spring inline-flex h-11 items-center gap-2 rounded-[14px] bg-[image:var(--gradient-accent)] px-5 text-[15px] font-bold shadow-[var(--shadow-btn)] transition-transform duration-300 hover:-translate-y-0.5"
      >
        <Sparkles className="h-4 w-4" />
        Get started
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
