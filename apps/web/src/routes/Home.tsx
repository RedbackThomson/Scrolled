// Home page — the launching pad a returning user lands on.
//
// First-run users see a single "Welcome" tile that points them at /setup;
// once they've loaded data the page becomes a hub composed of small
// self-gating widgets defined under `components/home/`. Each widget
// owns its own loading, empty-state, and feature-flag gating, which
// keeps this file a flat list of components rather than a tangle of
// conditional blocks.

import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import {
  BrowseTiles,
  ContinueStrip,
  EquipJobBreakdown,
  LibraryStats,
  MapsByRegion,
  MobLevelHistogram,
  PinnedCollectionsPanel,
  PinnedSearchesRow,
} from '@/components/home';
import { useFeatures } from '@/hooks/useFeatures';

export default function Home() {
  const features = useFeatures();

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

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Scrolled</h1>
      </header>

      <ContinueStrip />
      <PinnedCollectionsPanel />
      <PinnedSearchesRow />
      <BrowseTiles features={features} />
      <MapsByRegion features={features} />
      <LibraryStats features={features} />

      {(features.hasMobs || features.hasEquips) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MobLevelHistogram features={features} />
          <EquipJobBreakdown features={features} />
        </div>
      )}
    </div>
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
