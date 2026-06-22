// One-time reconciliation of locally-stored UI state with the synced
// user_settings / recents tables (docs/sync_design.md, Phase 1).
//
// Runs once at startup, fire-and-forget:
//   - hydrates accent + explicit theme from user_settings (seeding the table
//     from the localStorage mirror the first time, so a prior local choice is
//     adopted into the synced store);
//   - migrates the old idb-keyval recents into the recents table, then clears
//     the legacy keys.
//
// localStorage stays the synchronous boot mirror for accent/theme, so nothing
// flashes before the worker answers; this just makes user_settings the source
// of truth going forward.

import { get as idbGet, del as idbDel } from 'idb-keyval';
import type { Remote } from 'comlink';
import { getUserDbClient } from '@/db/user';
import type { UserDatabase } from '@/db/user';
import type { EntityKind } from '@/db';
import { isAccentName } from '@/lib/accents';
import { useAccent, ACCENT_SETTING_KEY } from '@/stores/accent';
import { useTheme, THEME_SETTING_KEY } from '@/stores/theme';

const LEGACY_ENTITIES_KEY = 'scrolled.recents.entities';
const LEGACY_QUERIES_KEY = 'scrolled.recents.queries';

interface LegacyRecentEntity {
  entity: EntityKind;
  id: number;
  name: string;
  viewedAt: number;
}

interface LegacyRecentQuery {
  query: string;
  ranAt: number;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

async function hydrateAccent(db: Remote<UserDatabase>): Promise<void> {
  const row = await db.getUserSetting(ACCENT_SETTING_KEY);
  if (row) {
    const accent = parseJson(row.value);
    if (isAccentName(accent)) useAccent.getState().hydrate(accent);
    return;
  }
  await db.setUserSetting(ACCENT_SETTING_KEY, JSON.stringify(useAccent.getState().accent));
}

async function hydrateTheme(db: Remote<UserDatabase>): Promise<void> {
  const row = await db.getUserSetting(THEME_SETTING_KEY);
  if (row) {
    const mode = parseJson(row.value);
    if (mode === 'light' || mode === 'dark') useTheme.getState().hydrate(mode);
    return;
  }
  // No synced override means "follow system" — only seed when the device has a
  // local explicit choice worth adopting.
  const mode = useTheme.getState().mode;
  if (mode !== 'system') await db.setUserSetting(THEME_SETTING_KEY, JSON.stringify(mode));
}

async function migrateLegacyRecents(db: Remote<UserDatabase>): Promise<void> {
  const entities = await idbGet<LegacyRecentEntity[]>(LEGACY_ENTITIES_KEY);
  if (entities?.length) {
    for (const e of entities) {
      if (e && e.entity && Number.isFinite(e.id)) {
        await db.trackRecentEntity(e.entity, e.id, e.name ?? '', e.viewedAt);
      }
    }
    await idbDel(LEGACY_ENTITIES_KEY);
  }

  const queries = await idbGet<LegacyRecentQuery[]>(LEGACY_QUERIES_KEY);
  if (queries?.length) {
    for (const q of queries) {
      if (q?.query) await db.trackRecentQuery(q.query, q.ranAt);
    }
    await idbDel(LEGACY_QUERIES_KEY);
  }
}

let started = false;

/** Idempotent: safe to call once per session. */
export function bootstrapSyncedState(): void {
  if (started) return;
  started = true;
  const db = getUserDbClient();
  void (async () => {
    try {
      await migrateLegacyRecents(db);
      await hydrateAccent(db);
      await hydrateTheme(db);
    } catch {
      // Best-effort: a failed reconcile leaves the local mirror in charge.
    }
  })();
}
