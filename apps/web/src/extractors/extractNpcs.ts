import type { GameDataSource } from '@/parser';
import type { NpcRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';
import { pickSprite } from './sprites';
import { unescapeWzString } from './wzText';

const log = createLogger('extract-npcs');

/**
 * Candidate sub-paths under `Npc.wz/<id>.img/` for the NPC's idle sprite.
 * `stand/0` is the canonical pose; the fallbacks cover NPCs that store
 * their main sprite under a different animation key.
 */
const NPC_SPRITE_CANDIDATES = ['stand/0', 'default/0', 'look/0', 'stand1/0'];

export interface ExtractNpcsResult {
  npcs: NpcRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Walk `Npc.wz` (each top-level `<id>.img` is one NPC) and join names from
 * `String.wz/Npc.img/<id>/name`. NPCs occasionally have a `func` string
 * (descriptor / role hint) in `String.wz/Npc.img/<id>/func`; if present, we
 * keep it as the description for the detail page.
 */
export async function extractNpcs(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractNpcsResult> {
  const npcs: NpcRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const root = await source.listChildren('Npc.wz');
  if (root.length === 0) {
    log.debug('Npc.wz absent or empty');
    return { npcs, skipped };
  }

  const imgs = root.filter((n) => /^(\d+)\.img$/.test(n.name));
  const total = imgs.length;
  log.info('discovery complete', { totalNpcs: total });

  let processed = 0;
  for (const img of imgs) {
    const idMatch = img.name.match(/^(\d+)\.img$/);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);

    opts.onProgress?.({
      phase: 'Extracting NPCs',
      current: processed,
      total,
      detail: `${img.name}`,
    });

    const [nameNode, funcNode] = await Promise.all([
      source.getNode(`String.wz/Npc.img/${id}/name`),
      source.getNode(`String.wz/Npc.img/${id}/func`),
    ]);

    const name = typeof nameNode?.scalar === 'string' && nameNode.scalar ? nameNode.scalar : null;
    if (!name) {
      skipped.push({ reason: 'no localized name', path: img.fullPath });
      processed += 1;
      continue;
    }

    const { iconPath, iconData } = await pickSprite(source, img.fullPath, NPC_SPRITE_CANDIDATES);

    npcs.push({
      id,
      name,
      description: typeof funcNode?.scalar === 'string' ? unescapeWzString(funcNode.scalar) : null,
      iconPath,
      iconData,
      sourcePath: img.fullPath,
    });
    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting NPCs', current: processed, total });
  log.info('extraction complete', { count: npcs.length, skipped: skipped.length });
  return { npcs, skipped };
}
