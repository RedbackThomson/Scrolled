import { isAnalyticsAvailable } from '@/analytics';

export type SettingsSectionNavItem =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'route'; to: string; label: string };

const BASE_SECTIONS: SettingsSectionNavItem[] = [
  { kind: 'section', id: 'library-status', label: 'Library Status' },
  { kind: 'section', id: 'appearance', label: 'Appearance' },
  { kind: 'section', id: 'collections', label: 'Collections' },
  { kind: 'section', id: 'game-data', label: 'Game Data' },
  { kind: 'section', id: 'import-export', label: 'Import & Export' },
  { kind: 'section', id: 'server', label: 'Server' },
  { kind: 'section', id: 'mcp', label: 'External Tools' },
  { kind: 'section', id: 'privacy', label: 'Privacy' },
  { kind: 'route', to: '/settings/developer', label: 'Developer' },
];

export function getSettingsNavItems(): SettingsSectionNavItem[] {
  if (isAnalyticsAvailable()) return BASE_SECTIONS;
  return BASE_SECTIONS.filter((item) => item.kind !== 'section' || item.id !== 'privacy');
}

export function sectionIdsFromNav(items: SettingsSectionNavItem[]): string[] {
  return items.filter((item) => item.kind === 'section').map((item) => item.id);
}
