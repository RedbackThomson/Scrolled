import { Bookmark, Cog, Home, LogIn, LogOut, User, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useIdentity } from '@scrolled/identity-core/react';
import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import {
  ENTITY_KINDS,
  iconForEntity,
  labelForEntityKind,
  listingRouteForEntity,
} from '@/lib/entityRoutes';
import { useCommandPalette } from '@/stores/useCommandPalette';
import { useFeatures } from '@/hooks/useFeatures';
import { appConfig } from '@/config';

interface NavEntry {
  id: string;
  label: string;
  keywords: string[];
  /** Where selecting the entry navigates. Omit for an action-only entry. */
  to?: string;
  /** Run instead of navigating (e.g. sign out). */
  action?: () => void;
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
  const user = useCurrentUser();
  const { logout } = useIdentity();

  const has: Record<string, boolean> = {
    item: features.hasItems,
    equip: features.hasEquips,
    mob: features.hasMobs,
    npc: features.hasNpcs,
    map: features.hasMaps,
    quest: features.hasQuests,
    questChain: features.hasQuestChains,
    skill: features.hasSkills,
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
      keywords: ['preferences', 'config', 'theme', 'data', 'backup', 'appearance'],
      to: '/settings',
      icon: Cog,
    },
    {
      id: 'nav-settings-appearance',
      label: 'Settings → Appearance',
      keywords: ['theme', 'dark', 'light', 'accent', 'ids'],
      to: '/settings#appearance',
      icon: Cog,
    },
    {
      id: 'nav-settings-import',
      label: appConfig.features.enableUserImport
        ? 'Settings → Import & Export'
        : 'Settings → Backup',
      keywords: appConfig.features.enableUserImport
        ? ['backup', 'export', 'import', 'restore']
        : ['backup', 'export'],
      to: '/settings#import-export',
      icon: Cog,
    },
    {
      id: 'nav-settings-developer',
      label: 'Settings → Developer',
      keywords: ['debug', 'parser', 'wz', 'tree', 'troubleshoot', 'diagnostics'],
      to: '/settings/developer',
      icon: Wrench,
    },
    ...accountEntries(),
  ];

  function accountEntries(): NavEntry[] {
    if (!appConfig.features.accountMenu) return [];
    if (!user.isAuthenticated) {
      return [
        {
          id: 'nav-sign-in',
          label: 'Sign in',
          keywords: ['login', 'account', 'sign in'],
          to: '/sign-in',
          icon: LogIn,
        },
      ];
    }
    return [
      {
        id: 'nav-account',
        label: 'Account',
        keywords: ['profile', 'user', 'settings'],
        to: '/settings#account',
        icon: User,
      },
      {
        id: 'nav-sign-out',
        label: 'Sign out',
        keywords: ['logout', 'sign out', 'log off'],
        action: () => void logout(),
        icon: LogOut,
      },
    ];
  }

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
              if (e.action) e.action();
              else if (e.to) navigate(e.to);
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
