// Shared sprite-picking logic used by the mob / NPC / map extractors.
//
// Each entity has a few plausible sub-paths under its .img where its main
// visual lives (NPCs: `stand/0`, mobs: `stand/0` then `move/0`/etc., maps:
// `miniMap/canvas`). This helper walks the candidate list, decodes the
// first one that returns bytes, and reports the path so the DB can store
// it for re-extraction / debugging.

import type { GameDataSource } from '../parser';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';

const log = createLogger('extract-sprites');

export interface PickedSprite {
  iconPath: string | null;
  iconData: Uint8Array | null;
}

const EMPTY: PickedSprite = { iconPath: null, iconData: null };

/**
 * Try each candidate sub-path under `basePath` in order. The first one
 * whose `getIconPng` returns non-null bytes wins. Failures are logged at
 * debug level so a missing sprite doesn't spam the diagnostic buffer.
 *
 * `basePath` is the WZ path of the entity's `.img` (e.g.
 * `Npc.wz/1000000.img`). Each candidate is joined as `${basePath}/${c}`.
 */
export async function pickSprite(
  source: GameDataSource,
  basePath: string,
  candidates: readonly string[],
): Promise<PickedSprite> {
  for (const candidate of candidates) {
    const fullPath = `${basePath}/${candidate}`;
    try {
      const bytes = await source.getIconPng(fullPath);
      if (bytes && bytes.byteLength > 0) {
        return { iconPath: fullPath, iconData: bytes };
      }
    } catch (e) {
      log.debug('sprite candidate threw', { path: fullPath, ...describeError(e) });
    }
  }
  return EMPTY;
}
