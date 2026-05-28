import {
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sidebar as SidebarIcon,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { useTheme, type ThemeMode } from '@/stores/theme';
import { useAccent } from '@/stores/accent';
import { ACCENTS } from '@/lib/accents';
import { useSidebarLayout } from '@/stores/sidebarState';

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

interface SidebarCommand {
  id: 'collapse' | 'expand' | 'toggle';
  label: string;
  keywords: string[];
  icon: LucideIcon;
  /** Only surfaces when the resolved layout matches this state, so we don't
   *  offer "Collapse" while already collapsed. `toggle` has no precondition. */
  visibleWhen?: (collapsed: boolean) => boolean;
  run: (api: {
    collapsed: boolean;
    setCollapsed: (v: boolean) => void;
    toggleCollapsed: () => void;
  }) => void;
}

const SIDEBAR_COMMANDS: SidebarCommand[] = [
  {
    id: 'collapse',
    label: 'Sidebar: Collapse',
    keywords: ['sidebar', 'collapse', 'hide', 'nav'],
    icon: PanelLeftClose,
    visibleWhen: (collapsed) => !collapsed,
    run: ({ setCollapsed }) => setCollapsed(true),
  },
  {
    id: 'expand',
    label: 'Sidebar: Expand',
    keywords: ['sidebar', 'expand', 'show', 'open', 'nav'],
    icon: PanelLeftOpen,
    visibleWhen: (collapsed) => collapsed,
    run: ({ setCollapsed }) => setCollapsed(false),
  },
  {
    id: 'toggle',
    label: 'Sidebar: Toggle',
    keywords: ['sidebar', 'toggle', 'nav'],
    icon: SidebarIcon,
    run: ({ toggleCollapsed }) => toggleCollapsed(),
  },
];

export function TogglesProvider() {
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);
  const current = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const currentAccent = useAccent((s) => s.accent);
  const setAccent = useAccent((s) => s.setAccent);
  const collapsed = useSidebarLayout((s) => s.collapsed);
  const setCollapsed = useSidebarLayout((s) => s.setCollapsed);
  const toggleCollapsed = useSidebarLayout((s) => s.toggleCollapsed);

  const themeItems = THEME_CHOICES.filter((c) => fuzzy(query, c.label));
  const accentItems = ACCENTS.filter((a) => fuzzy(query, `Accent: ${a.label}`));
  // Sidebar commands are intentionally hidden on an empty query — they're
  // utilities most users won't reach for, and we'd rather not crowd the
  // cold-open palette. They surface as soon as the user types something
  // matching ("sidebar", "collapse", "toggle", "nav", …).
  const hasQuery = query.trim().length > 0;
  const sidebarItems = hasQuery
    ? SIDEBAR_COMMANDS.filter((c) => !c.visibleWhen || c.visibleWhen(collapsed)).filter((c) =>
        fuzzy(query, `${c.label} ${c.keywords.join(' ')}`),
      )
    : [];

  if (themeItems.length === 0 && accentItems.length === 0 && sidebarItems.length === 0)
    return null;

  return (
    <CommandGroup heading="Toggles">
      {themeItems.map((c) => {
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
      {accentItems.map((a) => (
        <CommandItemPrimitive
          key={`accent-${a.name}`}
          value={`accent-${a.name}`}
          keywords={['accent', 'color', a.label, a.name]}
          onSelect={() => {
            setAccent(a.name);
            setOpen(false);
          }}
        >
          <span
            className="h-4 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: a.swatch }}
          />
          <span className="min-w-0 flex-1 truncate">Accent: {a.label}</span>
          {currentAccent === a.name && (
            <span className="text-muted-foreground shrink-0 text-xs">Active</span>
          )}
        </CommandItemPrimitive>
      ))}
      {sidebarItems.map((c) => {
        const Icon = c.icon;
        return (
          <CommandItemPrimitive
            key={`sidebar-${c.id}`}
            value={`sidebar-${c.id}`}
            keywords={c.keywords}
            onSelect={() => {
              c.run({ collapsed, setCollapsed, toggleCollapsed });
              setOpen(false);
            }}
          >
            <Icon className="text-muted-foreground h-4 w-4" />
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
