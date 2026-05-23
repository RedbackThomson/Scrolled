import type { GameDataSource } from '@/parser';
import type { MobRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-mobs');

export interface ExtractMobsResult {
  mobs: MobRecord[];
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
  const skipped: { reason: string; path: string }[] = [];

  const root = await source.listChildren('Mob.wz');
  if (root.length === 0) {
    log.debug('Mob.wz absent or empty');
    return { mobs, skipped };
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
      scalarNumber(source, `${infoPath}/level`),
      scalarNumber(source, `${infoPath}/maxHP`),
      scalarNumber(source, `${infoPath}/maxMP`),
      scalarNumber(source, `${infoPath}/exp`),
      scalarNumber(source, `${infoPath}/boss`),
      source.getNode(`${infoPath}/elemAttr`),
      source.getNode(`String.wz/Mob.img/${id}/name`),
    ]);

    const name = typeof nameNode?.scalar === 'string' && nameNode.scalar ? nameNode.scalar : null;
    if (!name) {
      skipped.push({ reason: 'no localized name', path: img.fullPath });
      processed += 1;
      continue;
    }

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
      sourcePath: img.fullPath,
    });
    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting mobs', current: processed, total });
  log.info('extraction complete', { count: mobs.length, skipped: skipped.length });
  return { mobs, skipped };
}

async function scalarNumber(source: GameDataSource, path: string): Promise<number | null> {
  const node = await source.getNode(path);
  if (!node) return null;
  if (typeof node.scalar === 'number') return node.scalar;
  if (typeof node.scalar === 'string') {
    const n = Number(node.scalar);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
