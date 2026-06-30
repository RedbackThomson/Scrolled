import {
  Database,
  FileArchive,
  FolderLock,
  FolderOpen,
  Package,
  RotateCcw,
  Search,
  Shield,
  Skull,
  Sparkles,
  Users,
  ChevronRight,
  Map as MapIcon,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { DataSourceKind } from '@/parser';
import { cn } from '@scrolled/ui';

const FEATURES: { Icon: LucideIcon; title: string; body: string }[] = [
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

const ENTITIES: { Icon: LucideIcon; label: string }[] = [
  { Icon: Package, label: 'Items' },
  { Icon: Shield, label: 'Equips' },
  { Icon: Skull, label: 'Mobs' },
  { Icon: Users, label: 'NPCs' },
  { Icon: MapIcon, label: 'Maps' },
  { Icon: ScrollText, label: 'Quests' },
];

interface Props {
  /** User picked which file format their game install uses. */
  onChoose: (kind: DataSourceKind) => void;
  /** User wants to restore from a previously exported backup instead. */
  onRestore: () => void;
}

/**
 * First-run splash. Pitches what the app does, then routes the user to the
 * file step with the format their install uses — or into the restore flow.
 * Hidden in update mode, where a returning user goes straight to the files
 * step.
 */
export function StepWelcome({ onChoose, onRestore }: Props) {
  return (
    <section className="space-y-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          aria-hidden
          className="h-16 w-16 rounded-xl shadow-sm"
        />
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Your private Mushroom Game wiki</h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-sm leading-relaxed">
            Scrolled turns your local game files into a fast, searchable reference — every category
            below, fully cross-linked. It all runs in this browser tab; nothing is uploaded, and it
            keeps working offline.
          </p>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-2">
          {ENTITIES.map(({ Icon, label }) => (
            <li
              key={label}
              className="border-border bg-card text-card-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            >
              <Icon className="text-primary h-3.5 w-3.5" />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {FEATURES.map(({ Icon, title, body }) => (
          <li
            key={title}
            className="border-border bg-card text-card-foreground flex items-start gap-2.5 rounded-md border p-4"
          >
            <Icon className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="text-sm font-medium">{title}</div>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{body}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-3">
        <div className="text-center">
          <h3 className="text-base font-semibold">Let's load your game</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Pick how your game files are stored. Not sure? Open your install folder and look.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            Icon={FileArchive}
            title="I have a WZ version"
            body="Your install folder holds a handful of files ending in .wz."
            onClick={() => onChoose('wz')}
          />
          <ChoiceCard
            Icon={FolderOpen}
            title="I have a IMG version"
            body="Your install folder has a Data folder of extracted .img files."
            onClick={() => onChoose('img')}
          />
        </div>
      </div>

      <div className="border-border flex flex-col items-center gap-1 border-t pt-5 text-center">
        <p className="text-muted-foreground text-xs">Set up this device before?</p>
        <button
          type="button"
          onClick={onRestore}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restore from a backup
        </button>
      </div>
    </section>
  );
}

function ChoiceCard({
  Icon,
  title,
  body,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-border bg-card text-card-foreground group flex items-start gap-3 rounded-md border p-4 text-left transition-colors',
        'hover:border-primary/60 hover:bg-primary/5 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
      )}
    >
      <span className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-sm font-medium">
          {title}
          <ChevronRight className="text-muted-foreground group-hover:text-primary h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
        <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">{body}</span>
      </span>
    </button>
  );
}
