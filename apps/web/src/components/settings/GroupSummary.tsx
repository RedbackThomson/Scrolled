import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@scrolled/identity-core/react';
import { useSyncStatus } from '@scrolled/sync-core/react';
import { Chip, useTheme, type ThemeMode } from '@scrolled/design';
import type { SettingsGroupId } from '@/components/settings/settingsGroups';
import { presentSyncStatus } from '@/components/sync/syncPresentation';
import { appConfig } from '@/config';
import { getDbClient } from '@/db';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useServerProfile } from '@/hooks/useServerProfile';
import { ACCENTS } from '@/lib/accents';
import { useBridgeStatus } from '@/mcp';
import { useAccent } from '@/stores/accent';

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

/** A glance at each settings group's current state, shown on its hub tile. */
export function GroupSummary({ id }: { id: SettingsGroupId }) {
  switch (id) {
    case 'library':
      return <LibrarySummary />;
    case 'look':
      return <LookSummary />;
    case 'account':
      return appConfig.features.accountMenu ? <AccountSummary /> : null;
    case 'advanced':
      return <AdvancedSummary />;
  }
}

function Chips({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-wrap gap-1.5">{children}</div>;
}

function LibrarySummary() {
  const db = useMemo(() => getDbClient(), []);
  const statusQ = useQuery({ queryKey: ['db', 'status'], queryFn: () => db.status() });
  const { profile } = useServerProfile();
  const status = statusQ.data;
  if (!status) return null;
  const { items, equips, mobs, npcs, maps, quests, skills } = status.counts;
  const entries = items + equips + mobs + npcs + maps + quests + skills;
  return (
    <Chips>
      <Chip>{entries.toLocaleString()} entries</Chip>
      {status.backend === 'opfs' ? (
        <Chip tone="ok">Persistent storage</Chip>
      ) : (
        <Chip tone="hue" hue={70}>
          Not persistent
        </Chip>
      )}
      {appConfig.features.enableUserImport && <Chip>Server: {profile.name}</Chip>}
    </Chips>
  );
}

function LookSummary() {
  const mode = useTheme((s) => s.mode);
  const accent = useAccent((s) => s.accent);
  const { backdrop } = useMotionPrefs();
  const accentLabel = ACCENTS.find((a) => a.name === accent)?.label;
  return (
    <Chips>
      <Chip>{THEME_LABELS[mode]}</Chip>
      {accentLabel && <Chip>{accentLabel} accent</Chip>}
      <Chip>{backdrop === 'clouds' ? 'Clouds on' : 'Clouds off'}</Chip>
    </Chips>
  );
}

function AccountSummary() {
  const user = useCurrentUser();
  return (
    <Chips>
      <Chip>
        {user.isAuthenticated ? (user.displayName ?? user.email ?? 'Signed in') : 'Signed out'}
      </Chip>
      {appConfig.features.sync && user.isAuthenticated && <SyncChip />}
    </Chips>
  );
}

function SyncChip() {
  const { status } = useSyncStatus();
  return <Chip>{presentSyncStatus(status).label}</Chip>;
}

function AdvancedSummary() {
  const { status } = useBridgeStatus();
  return (
    <Chips>
      {status === 'open' ? (
        <Chip tone="ok">MCP bridge connected</Chip>
      ) : (
        <Chip>{status === 'connecting' ? 'MCP bridge connecting' : 'MCP bridge off'}</Chip>
      )}
    </Chips>
  );
}
