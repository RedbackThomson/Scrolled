import { Monitor, Moon, Sun } from 'lucide-react';
import {
  CommandGroup,
  CommandItem as CommandItemPrimitive,
} from '@/components/ui/command';
import { useCommandPalette } from '@/lib/useCommandPalette';
import { useTheme, type ThemeMode } from '@/lib/theme';

function fuzzy(q: string, hay: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return hay.toLowerCase().includes(t);
}

interface ThemeChoice {
  id: ThemeMode;
  label: string;
  icon: typeof Sun;
}

const THEME_CHOICES: ThemeChoice[] = [
  { id: 'light', label: 'Theme: Light', icon: Sun },
  { id: 'dark', label: 'Theme: Dark', icon: Moon },
  { id: 'system', label: 'Theme: System', icon: Monitor },
];

export function TogglesProvider() {
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const current = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);

  const items = THEME_CHOICES.filter((c) => fuzzy(query, c.label));
  if (items.length === 0) return null;

  return (
    <CommandGroup heading="Toggles">
      {items.map((c) => {
        const Icon = c.icon;
        return (
          <CommandItemPrimitive
            key={`theme-${c.id}`}
            value={`theme-${c.id}`}
            keywords={['theme', c.label, c.id]}
            onSelect={() => {
              setMode(c.id);
              setOpen(false);
            }}
          >
            <Icon className="text-muted-foreground h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
            {current === c.id && (
              <span className="text-muted-foreground shrink-0 text-xs">Active</span>
            )}
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
