import type { GameDataSource } from '@/parser';
import { pathToNumber } from './wzCoerce';
import type { MobDropRecord, MobRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';
import { pickSprite } from './sprites';

const log = createLogger('extract-mobs');

/**
 * Candidates for a mob's display sprite. `stand/0` covers most regular
 * monsters; flying / boss mobs often skip stand entirely so we fall back
 * through their alternate idle animations.
 */
const MOB_SPRITE_CANDIDATES = ['stand/0', 'move/0', 'fly/0', 'regen/0', 'jump/0'];

export interface ExtractMobsResult {
  mobs: MobRecord[];
  /** Possible drops per mob from `String.wz/MonsterBook.img/<id>/reward`. */
  drops: MobDropRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Walk `Mob.wz` (each top-level `<id>.img` is one monster), join names from
 * `String.wz/Mob.img/<id>/name`, and emit normalized `MobRecord`s.
 *
 * Mob sprites would live deeper inside each image (e.g. `<id>.img/stand/0` and
 * other animation states); decoding them is deferred to a later phase since
 * sprites aren't required for browsing.
 */
export async function extractMobs(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractMobsResult> {
  const mobs: MobRecord[] = [];
  const drops: MobDropRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const root = await source.listChildren('Mob.wz');
  if (root.length === 0) {
    log.debug('Mob.wz absent or empty');
    return { mobs, drops, skipped };
  }

  // Discovery — each child of Mob.wz is a `<id>.img`.
  const imgs = root.filter((n) => /^(\d+)\.img$/.test(n.name));
  const total = imgs.length;
  log.info('discovery complete', { totalMobs: total });

  let processed = 0;
  for (const img of imgs) {
    const idMatch = img.name.match(/^(\d+)\.img$/);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);

    opts.onProgress?.({
      phase: 'Extracting mobs',
      current: processed,
      total,
      detail: `${img.name}`,
    });

    const infoPath = `${img.fullPath}/info`;
    const [levelN, hpN, mpN, expN, bossN, elemN, nameNode] = await Promise.all([
      pathToNumber(source, `${infoPath}/level`),
      pathToNumber(source, `${infoPath}/maxHP`),
      pathToNumber(source, `${infoPath}/maxMP`),
      pathToNumber(source, `${infoPath}/exp`),
      pathToNumber(source, `${infoPath}/boss`),
      source.getNode(`${infoPath}/elemAttr`),
      source.getNode(`String.wz/Mob.img/${id}/name`),
    ]);

    const name = typeof nameNode?.scalar === 'string' && nameNode.scalar ? nameNode.scalar : null;
    if (!name) {
      skipped.push({ reason: 'no localized name', path: img.fullPath });
      processed += 1;
      continue;
    }

    const { iconPath, iconData } = await pickSprite(source, img.fullPath, MOB_SPRITE_CANDIDATES);

    mobs.push({
      id,
      name,
      level: levelN,
      hp: hpN,
      mp: mpN,
      exp: expN,
      isBoss: bossN === 1,
      elementAttack: typeof elemN?.scalar === 'string' ? elemN.scalar : null,
      elementDefensesJson: null,
      iconPath,
      iconData,
      sourcePath: img.fullPath,
    });

    // Drop possibilities live in String.wz/MonsterBook.img/<id>/reward. Each
    // reward child is an integer leaf containing an item or equip ID. The
    // node may be absent for mobs that have no Monster Book entry — that's
    // expected and not an error.
    const rewardChildren = await source.listChildren(`String.wz/MonsterBook.img/${id}/reward`);
    for (const r of rewardChildren) {
      const itemId = typeof r.scalar === 'number' ? r.scalar : Number(r.scalar);
      if (Number.isFinite(itemId) && itemId > 0) {
        drops.push({ mobId: id, itemId });
      }
    }

    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting mobs', current: processed, total });
  log.info('extraction complete', {
    count: mobs.length,
    drops: drops.length,
    skipped: skipped.length,
  });
  return { mobs, drops, skipped };
}
