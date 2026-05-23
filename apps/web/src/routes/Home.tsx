import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Map as MapIcon,
  Package,
  Shield,
  Skull,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useFeatures } from '@/lib/useFeatures';

export default function Home() {
  const features = useFeatures();

  if (!features.ready) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">Mushroom Game Explorer</h1>
        <p className="text-muted-foreground mt-2 text-sm">Loading…</p>
      </div>
    );
  }

  if (!features.hasAny) {
    return <Welcome />;
  }

  return <Dashboard features={features} />;
}

function Welcome() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Set up your wiki by loading your local WZ files. Everything stays in your browser — no
          uploads, no remote services.
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

interface Tile {
  label: string;
  to: string;
  icon: LucideIcon;
  enabled: boolean;
  count: number;
}

function Dashboard({ features }: { features: ReturnType<typeof useFeatures> }) {
  const counts = features.counts ?? {
    items: 0,
    equips: 0,
    mobs: 0,
    npcs: 0,
    maps: 0,
    quests: 0,
    datasets: 0,
  };
  const tiles: Tile[] = [
    {
      label: 'Items',
      to: '/items',
      icon: Package,
      enabled: features.hasItems,
      count: counts.items,
    },
    {
      label: 'Equips',
      to: '/equips',
      icon: Shield,
      enabled: features.hasEquips,
      count: counts.equips,
    },
    { label: 'Mobs', to: '/mobs', icon: Skull, enabled: features.hasMobs, count: counts.mobs },
    { label: 'NPCs', to: '/npcs', icon: Users, enabled: features.hasNpcs, count: counts.npcs },
    { label: 'Maps', to: '/maps', icon: MapIcon, enabled: features.hasMaps, count: counts.maps },
  ];
  const enabled = tiles.filter((t) => t.enabled);
  const missingAny = enabled.length < tiles.length;

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Mushroom Game Explorer</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Browse the data you've loaded. Search anything in the top bar, or pick a category below.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {enabled.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className="border-border bg-card text-card-foreground hover:border-foreground/30 group flex items-center gap-3 rounded-md border p-4 transition-colors"
          >
            <t.icon className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 transition-colors" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-muted-foreground font-mono text-xs">
                {t.count.toLocaleString()}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {missingAny && (
        <div className="border-border bg-muted/40 rounded-md border p-4 text-sm">
          <p className="font-medium">Want more sections?</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Other entity types appear here once you load their{' '}
            <code className="font-mono">.wz</code> files.{' '}
            <Link to="/settings" className="text-primary hover:underline">
              Manage WZ files in Settings →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
