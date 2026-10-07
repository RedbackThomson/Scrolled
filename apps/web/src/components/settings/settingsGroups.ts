import { Library, Palette, UserRound, Wrench, type LucideIcon } from 'lucide-react';
import { isAnalyticsAvailable } from '@/analytics';
import { appConfig } from '@/config';

export type SettingsGroupId = 'library' | 'look' | 'account' | 'advanced';

export interface SettingsSectionRef {
  /** Element id on the group page, so `/settings/<group>#<id>` lands on it. */
  id: string;
  label: string;
  /** Extra words the settings search matches, beyond the label. */
  keywords: string[];
}

export interface SettingsGroup {
  id: SettingsGroupId;
  label: string;
  description: string;
  icon: LucideIcon;
  hue: number;
  sections: SettingsSectionRef[];
}

/** Groups and sections visible in this build, in display order. */
export function getSettingsGroups(): SettingsGroup[] {
  const canImport = appConfig.features.enableUserImport;
  const accountMenu = appConfig.features.accountMenu;
  const analytics = isAnalyticsAvailable();
  const groups: SettingsGroup[] = [
    {
      id: 'library',
      label: 'Library',
      description: 'Your loaded game data, collections, backups, and server.',
      icon: Library,
      hue: 185,
      sections: [
        {
          id: 'library-status',
          label: 'Library status',
          keywords: ['storage', 'database', 'dataset', 'version', 'update'],
        },
        ...(canImport
          ? [
              {
                id: 'game-data',
                label: 'Game data',
                keywords: ['files', 'wz', 'import', 'rebuild', 'delete'],
              },
            ]
          : []),
        {
          id: 'import-export',
          label: canImport ? 'Import & export' : 'Backup',
          keywords: ['backup', 'restore', 'export', 'import', 'file'],
        },
        {
          id: 'collections',
          label: 'Collections',
          keywords: ['saved', 'lists', 'import', 'export', 'json'],
        },
        ...(canImport
          ? [{ id: 'server', label: 'Server', keywords: ['profile', 'rates', 'exp', 'drop'] }]
          : []),
      ],
    },
    {
      id: 'look',
      label: 'Look & feel',
      description: 'Theme, accent, and tooltips.',
      icon: Palette,
      hue: 295,
      sections: [
        {
          id: 'appearance',
          label: 'Appearance',
          keywords: [
            'theme',
            'dark',
            'light',
            'system',
            'accent',
            'color',
            'ids',
            'portals',
            'backdrop',
            'clouds',
            'motion',
            'animation',
          ],
        },
        {
          id: 'customization',
          label: 'Customization',
          keywords: ['tooltips', 'hover', 'preview', 'fields', 'magic', 'stats', 'saved searches'],
        },
      ],
    },
    {
      id: 'account',
      label: accountMenu ? 'Account' : 'Privacy',
      description: accountDescription(),
      icon: UserRound,
      hue: 150,
      sections: [
        ...(accountMenu
          ? [
              {
                id: 'account',
                label: appConfig.features.sync ? 'Account & sync' : 'Account',
                keywords: ['sign in', 'sign out', 'login', 'sync', 'devices', 'profile'],
              },
            ]
          : []),
        ...(analytics
          ? [{ id: 'privacy', label: 'Privacy', keywords: ['analytics', 'tracking', 'opt out'] }]
          : []),
      ],
    },
    {
      id: 'advanced',
      label: 'Advanced',
      description: 'External tools and developer options.',
      icon: Wrench,
      hue: 235,
      sections: [
        { id: 'mcp', label: 'External tools', keywords: ['mcp', 'bridge', 'ai', 'assistant'] },
      ],
    },
  ];
  return groups.filter((g) => g.sections.length > 0);
}

function accountDescription(): string {
  const { accountMenu, sync } = appConfig.features;
  const privacy = isAnalyticsAvailable();
  if (!accountMenu) return 'Anonymous pageview analytics.';
  if (sync)
    return privacy
      ? 'Sign in, sync, and privacy.'
      : 'Sign in and sync your collections across devices.';
  return privacy ? 'Sign in and privacy.' : 'Sign in to your account.';
}

export function isSettingsGroupId(v: string | undefined): v is SettingsGroupId {
  return v === 'library' || v === 'look' || v === 'account' || v === 'advanced';
}

export interface SettingsSearchHit {
  group: SettingsGroup;
  section: SettingsSectionRef;
}

/** Sections whose label, keywords, or group label contain every word of the query. */
export function searchSettings(query: string): SettingsSearchHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return getSettingsGroups().flatMap((group) =>
    group.sections
      .filter((section) => {
        const hay = [section.label, group.label, ...section.keywords].join(' ').toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .map((section) => ({ group, section })),
  );
}
