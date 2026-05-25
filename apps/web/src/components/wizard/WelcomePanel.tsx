import { Database, FolderLock, Search, Sparkles } from 'lucide-react';

const FEATURES: { Icon: typeof Sparkles; title: string; body: string }[] = [
  {
    Icon: FolderLock,
    title: 'Everything stays on your device',
    body: 'Your game files are read in this browser tab. Nothing is uploaded anywhere.',
  },
  {
    Icon: Database,
    title: 'One-time setup, then instant',
    body: 'After this run, the index lives in a local database. Pages load offline and open in milliseconds.',
  },
  {
    Icon: Search,
    title: 'Search and filter everything',
    body: 'Field filters, equip stat ranges, mob drops, NPC scripts — every list is browsable and filterable.',
  },
  {
    Icon: Sparkles,
    title: 'Collections you control',
    body: 'Pin items, build sets, and export your collection as a file you can share or back up.',
  },
];

/**
 * First-run welcome / explainer. Hidden in update and restore modes — a
 * returning user doesn't need the pitch.
 */
export function WelcomePanel() {
  return (
    <section className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-5">
      <div>
        <h2 className="text-lg font-semibold">Your private Mushroom Game wiki</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Mushroom Game Explorer turns your local game files into a fast, searchable reference —
          items, equips, mobs, NPCs, maps, and quests, all cross-linked.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ Icon, title, body }) => (
          <li key={title} className="flex items-start gap-2.5">
            <Icon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-sm font-medium">{title}</div>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs">
        Pick which categories you want below. You only need the files for the entities you care
        about.
      </p>
    </section>
  );
}
