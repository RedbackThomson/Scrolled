// Home page — the launching pad a returning user lands on.
//
// First-run users see a single "Welcome" tile that points them at /setup;
// once they've loaded data the page becomes a hub composed of small
// self-gating widgets defined under `components/home/`. The order and
// visibility of those widgets are user-editable (Edit / Done button) and
// persisted to the user DB so the layout rides backup/restore.

import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Pencil, Sparkles } from 'lucide-react';
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

const HomeEditor = lazy(() =>
  import('@/components/home/HomeEditor').then((m) => ({ default: m.HomeEditor })),
);

export default function Home() {
  const features = useFeatures();
  const layout = useHomeLayout();
  const [editing, setEditing] = useState(false);

  if (!features.ready) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Scrolled</h1>
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
        <h1 className="text-3xl font-semibold tracking-tight">Scrolled</h1>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="border-border bg-card text-card-foreground hover:border-foreground/30 inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
          title={editing ? 'Finish editing' : 'Edit dashboard'}
        >
          {editing ? (
            <>
              <Check className="h-4 w-4" /> Done
            </>
          ) : (
            <>
              <Pencil className="h-4 w-4" /> Edit
            </>
          )}
        </button>
      </header>

      {editing ? (
        <HomeSectionProvider editing>
          <Suspense fallback={<HomeSectionPlaceholder label="Editor" />}>
            <HomeEditor layout={layout} renderSection={renderSection} />
          </Suspense>
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
      className="border-border bg-muted/30 h-48 animate-pulse rounded-lg border"
      aria-busy
      aria-label={`Loading ${label}`}
    />
  );
}

function Welcome() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A personal wiki that adapts to your version of the Mushroom Game. Load your game files to
          fill it in.
        </p>
      </header>
      <Link
        to="/setup"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium"
      >
        <Sparkles className="h-4 w-4" />
        Get started
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
