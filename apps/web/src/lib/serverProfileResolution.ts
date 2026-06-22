// Resolves the active server profile, the one place the fixed-vs-generic split
// lives (docs/sync_design.md §6.4).
//
//   - fixed-hosted-dataset: the dataset's baked-in inline profile (game DB) is
//     authoritative and never user-overridable, so it's never synced.
//   - generic: the user picks a bundled profile by id; that selection lives in
//     the user DB (`user_settings`) and syncs.
//
// Shared by the React hook and the MCP tools so all readers agree.

import { appConfig } from '@/config';
import {
  resolveServerProfile,
  serverProfileSchema,
  type ServerProfile,
} from '@scrolled/game-db/serverProfiles';

export const ACTIVE_PROFILE_KEY = 'activeServerProfile';

interface GameProfileReader {
  getActiveServerProfile(): Promise<unknown>;
}

interface UserSettingReader {
  getUserSetting(key: string): Promise<{ value: string } | null>;
}

interface UserSettingWriter {
  setUserSetting(key: string, value: string): Promise<unknown>;
}

function readSettingId(value: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'string' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The active profile. In fixed mode this is the dataset's inline config (a
 * stored config that fails validation falls back to the baseline); in generic
 * mode it's the bundled profile named by the synced user setting.
 */
export async function resolveActiveServerProfile(
  game: GameProfileReader,
  user: UserSettingReader,
): Promise<ServerProfile> {
  if (appConfig.deploymentProfile === 'fixed-hosted-dataset') {
    const config = await game.getActiveServerProfile();
    const parsed = serverProfileSchema.safeParse(config);
    if (parsed.success) return parsed.data;
    return resolveServerProfile(undefined);
  }
  const row = await user.getUserSetting(ACTIVE_PROFILE_KEY);
  const id = row ? readSettingId(row.value) : undefined;
  return resolveServerProfile(id);
}

/**
 * Persist the generic-mode profile selection. A no-op in fixed mode, where the
 * dataset's inline profile is authoritative and the setting is ignored.
 */
export async function setActiveServerProfileId(
  user: UserSettingWriter,
  id: string,
): Promise<void> {
  if (appConfig.deploymentProfile === 'fixed-hosted-dataset') return;
  await user.setUserSetting(ACTIVE_PROFILE_KEY, JSON.stringify(id));
}
