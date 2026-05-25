import { useCommandPalette } from '@/lib/useCommandPalette';

interface Row {
  keys: string[];
  desc: string;
}

const PREFIXES: Row[] = [
  { keys: ['m'], desc: 'Mobs (e.g. `m gob`)' },
  { keys: ['i'], desc: 'Items' },
  { keys: ['e'], desc: 'Equips' },
  { keys: ['n'], desc: 'NPCs' },
  { keys: ['mp'], desc: 'Maps' },
  { keys: ['q'], desc: 'Quests' },
];

const FILTERS: Row[] = [
  { keys: ['mobs level:50-70 boss'], desc: 'Range filter + bare boolean' },
  { keys: ['equips slot:hat cash:false'], desc: 'Enum + boolean' },
  { keys: ['items category:use'], desc: 'Enum filter' },
  { keys: ['mobs level:>=80'], desc: '>=, <=, >, < comparators' },
  { keys: ['1212000'], desc: 'Paste a raw ID to jump' },
];

function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground inline-flex h-5 select-none items-center rounded border px-1.5 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div>
      <div className="text-muted-foreground mb-1.5 text-[10px] font-medium uppercase tracking-wide">
        {title}
      </div>
      <dl className="space-y-1">
        {rows.map((r) => (
          <div key={r.keys.join('-')} className="flex items-center gap-2 text-xs">
            <dt className="flex shrink-0 flex-wrap gap-1">
              {r.keys.map((k) => (
                <KeyChip key={k}>{k}</KeyChip>
              ))}
            </dt>
            <dd className="text-muted-foreground min-w-0 truncate">{r.desc}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Quick reference rendered when the input is empty (or the user typed `?`).
 * Static content — not selectable. Acts as the spec's "Show keyboard
 * shortcuts" cheatsheet without a separate modal.
 */
export function HelpProvider() {
  const query = useCommandPalette((s) => s.query);
  if (query.trim() !== '?') return null;

  return (
    <div className="border-border grid gap-4 border-b p-3 sm:grid-cols-2">
      <Section title="Entity prefixes" rows={PREFIXES} />
      <Section title="Filter syntax" rows={FILTERS} />
    </div>
  );
}
