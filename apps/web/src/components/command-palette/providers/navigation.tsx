import { Bookmark, Cog, Home, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CommandGroup,
  CommandItem as CommandItemPrimitive,
} from '@/components/ui/command';
import {
  ENTITY_KINDS,
  iconForEntity,
  labelForEntityKind,
  listingRouteForEntity,
} from '@/lib/entityRoutes';
import { useCommandPalette } from '@/lib/useCommandPalette';
import { useFeatures } from '@/lib/useFeatures';

interface NavEntry {
  id: string;
  label: string;
  keywords: string[];
  to: string;
  icon: LucideIcon;
}

function matches(query: string, entry: NavEntry): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [entry.label, ...entry.keywords].join(' ').toLowerCase();
  return hay.includes(q);
}

export function NavigationProvider() {
  const navigate = useNavigate();
  const features = useFeatures();
  const query = useCommandPalette((s) => s.query);
  const setOpen = useCommandPalette((s) => s.setOpen);

  const has: Record<string, boolean> = {
    item: features.hasItems,
    equip: features.hasEquips,
    mob: features.hasMobs,
    npc: features.hasNpcs,
    map: features.hasMaps,
    quest: features.hasQuests,
  };

  const entries: NavEntry[] = [
    { id: 'nav-home', label: 'Home', keywords: ['index'], to: '/', icon: Home },
    ...ENTITY_KINDS.filter((k) => has[k]).map((k) => ({
      id: `nav-${k}`,
      label: labelForEntityKind(k, true),
      keywords: [k, labelForEntityKind(k).toLowerCase()],
      to: listingRouteForEntity(k),
      icon: iconForEntity(k),
    })),
    {
      id: 'nav-collections',
      label: 'Collections',
      keywords: ['saved', 'lists'],
      to: '/collections',
      icon: Bookmark,
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      keywords: ['preferences', 'config', 'theme', 'data'],
      to: '/settings',
      icon: Cog,
    },
    {
      id: 'nav-debug',
      label: 'Parser debug',
      keywords: ['wz', 'tree'],
      to: '/debug',
      icon: Wrench,
    },
  ];

  const visible = entries.filter((e) => matches(query, e));
  if (visible.length === 0) return null;

  return (
    <CommandGroup heading="Go to">
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
