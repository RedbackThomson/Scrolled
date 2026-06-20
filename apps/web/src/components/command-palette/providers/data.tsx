import { Database, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { appConfig } from '@/config';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

const ENTRIES = [
  {
    id: 'data-reload',
    label: 'Reload data files',
    keywords: ['setup', 'wizard', 'reimport', 'wz'],
    to: '/setup',
    icon: Database,
    // Setup/import only exists on deployments where the user supplies files.
    requiresImport: true,
  },
  {
    id: 'data-developer',
    label: 'Developer tools',
    keywords: ['debug', 'parser', 'wz', 'tree', 'troubleshoot', 'diagnostics'],
    to: '/settings/developer',
    icon: Wrench,
  },
].filter((e) => !e.requiresImport || appConfig.features.enableUserImport);

export function DataProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);

  const visible = ENTRIES.filter((e) => fuzzy(query, `${e.label} ${e.keywords.join(' ')}`));
  if (visible.length === 0) return null;

  return (
    <CommandGroup heading="Data">
      {visible.map((e) => {
        const Icon = e.icon;
        return (
          <CommandItemPrimitive
            key={e.id}
            value={e.id}
            keywords={[e.label, ...e.keywords]}
            onSelect={() => {
              navigate(e.to);
              setOpen(false);
            }}
          >
            <Icon className="text-muted-foreground h-4 w-4" />
            <span>{e.label}</span>
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
