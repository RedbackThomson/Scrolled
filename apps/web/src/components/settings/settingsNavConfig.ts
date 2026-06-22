import { isAnalyticsAvailable } from '@/analytics';
import { appConfig } from '@/config';

export type SettingsSectionNavItem =
  | { kind: 'section'; id: string; label: string }
  | { kind: 'route'; to: string; label: string };

const BASE_SECTIONS: SettingsSectionNavItem[] = [
  { kind: 'section', id: 'library-status', label: 'Library Status' },
  { kind: 'section', id: 'account', label: 'Account' },
  { kind: 'section', id: 'sync', label: 'Sync' },
  { kind: 'section', id: 'appearance', label: 'Appearance' },
  { kind: 'section', id: 'collections', label: 'Collections' },
  { kind: 'section', id: 'game-data', label: 'Game Data' },
  { kind: 'section', id: 'import-export', label: 'Import & Export' },
  { kind: 'section', id: 'server', label: 'Server' },
  { kind: 'section', id: 'mcp', label: 'External Tools' },
  { kind: 'section', id: 'privacy', label: 'Privacy' },
  { kind: 'route', to: '/settings/developer', label: 'Developer' },
];

function isHidden(item: SettingsSectionNavItem): boolean {
  if (item.kind !== 'section') return false;
  if (item.id === 'privacy') return !isAnalyticsAvailable();
  if (item.id === 'account') return !appConfig.features.accountMenu;
  if (item.id === 'sync') return !appConfig.features.sync;
  return false;
}

export function getSettingsNavItems(): SettingsSectionNavItem[] {
  return BASE_SECTIONS.filter((item) => !isHidden(item));
}

export function sectionIdsFromNav(items: SettingsSectionNavItem[]): string[] {
  return items.filter((item) => item.kind === 'section').map((item) => item.id);
}
