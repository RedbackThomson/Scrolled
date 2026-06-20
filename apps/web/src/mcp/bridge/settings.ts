// uiPref-backed settings for the bridge. The toggle and URL live in the
// shared `ui_prefs` table so they survive reloads and roundtrip through
// the user-data export/import. Anyone may subscribe — the Settings panel
// re-renders, and `initMcp` listens to restart the bridge live on change.

import { z } from 'zod';
import { getUserDbClient } from '@/db/user';
import { createLogger } from '@scrolled/extractor/lib/logger';

const log = createLogger('mcp/settings');

export const BRIDGE_PREF_KEY = 'mcp.bridge';

export interface BridgeSettings {
  enabled: boolean;
  url: string;
}

export const DEFAULT_BRIDGE_SETTINGS: BridgeSettings = {
  enabled: false,
  url: 'ws://localhost:8765',
};

const bridgeSettingsSchema = z.object({
  enabled: z.boolean(),
  url: z.string().min(1),
});

type Listener = (next: BridgeSettings) => void;
const listeners = new Set<Listener>();

let cached: BridgeSettings | null = null;

export async function readBridgeSettings(): Promise<BridgeSettings> {
  if (cached) return cached;
  const db = getUserDbClient();
  try {
    const row = await db.getUiPref(BRIDGE_PREF_KEY);
    if (!row) {
      cached = DEFAULT_BRIDGE_SETTINGS;
      return cached;
    }
    const parsed = bridgeSettingsSchema.safeParse(JSON.parse(row.value));
    cached = parsed.success ? parsed.data : DEFAULT_BRIDGE_SETTINGS;
  } catch (e) {
    log.warn('failed to read bridge settings, using defaults', {
      err: e instanceof Error ? e.message : String(e),
    });
    cached = DEFAULT_BRIDGE_SETTINGS;
  }
  return cached;
}

export async function writeBridgeSettings(next: BridgeSettings): Promise<void> {
  const validated = bridgeSettingsSchema.parse(next);
  cached = validated;
  const db = getUserDbClient();
  await db.setUiPref(BRIDGE_PREF_KEY, JSON.stringify(validated));
  for (const fn of listeners) fn(validated);
}

export function subscribeBridgeSettings(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
