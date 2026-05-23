import type { GameDataSource } from '@/parser';
import type { EquipRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-equips');

export interface ExtractEquipsResult {
  equips: EquipRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Phase 3 light pass: pull equipment names and slot/category from
 * `String.wz/Eqp.img/Eqp/<slot>/<id>`. Stat blocks (attack, defense,
 * job/level requirements, upgrade slots…) live in `Character.wz`, which is
 * ~800 MB and not yet supported by the in-memory load path. When that lands,
 * extend this extractor to populate the empty stat columns.
 */
export async function extractEquips(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractEquipsResult> {
  const equips: EquipRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const eqpRoot = 'String.wz/Eqp.img/Eqp';
  const slots = await source.listChildren(eqpRoot);
  if (slots.length === 0) {
    log.debug('Eqp.img/Eqp empty or absent', { path: eqpRoot });
    return { equips, skipped };
  }

  let slotIdx = 0;
  for (const slot of slots) {
    if (!slot.hasChildren) {
      slotIdx++;
      continue;
    }
    const slotKey = slot.name.toLowerCase();
    opts.onProgress?.({
      phase: 'Equips',
      current: equips.length,
      total: 0,
      detail: `${slot.name} (${slotIdx + 1}/${slots.length})`,
    });
    const idEntries = await source.listChildren(slot.fullPath);

    for (const entry of idEntries) {
      const idMatch = entry.name.match(/^(\d+)$/);
      if (!idMatch) continue;
      const id = Number(idMatch[1]);
      const nameNode = await source.getNode(`${entry.fullPath}/name`);
      const descNode = await source.getNode(`${entry.fullPath}/desc`);
      if (typeof nameNode?.scalar !== 'string' || !nameNode.scalar) {
        skipped.push({ reason: 'no name', path: entry.fullPath });
        continue;
      }
      equips.push({
        id,
        name: nameNode.scalar,
        description: typeof descNode?.scalar === 'string' ? descNode.scalar : null,
        slot: slotKey,
        category: slotKey,
        requiredLevel: null,
        requiredStr: null,
        requiredDex: null,
        requiredInt: null,
        requiredLuk: null,
        requiredJob: null,
        attack: null,
        magicAttack: null,
        defense: null,
        magicDefense: null,
        accuracy: null,
        avoidability: null,
        upgradeSlots: null,
        iconPath: null,
        sourcePath: entry.fullPath,
      });
    }
    slotIdx++;
  }

  log.info('equip extraction complete', { count: equips.length, skipped: skipped.length });
  return { equips, skipped };
}
