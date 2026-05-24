import type { GameDataSource, WzNodeInfo } from '@/parser';
import type { ItemRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';

const log = createLogger('extract-items');

/**
 * Item.wz top-level categories we know how to extract. Each maps to the
 * String.wz image holding localized names + descriptions for that category,
 * and the `items.category` value we write into the database.
 *
 * Equipment (Item.wz/Eqp) and pets (Item.wz/Pet) are intentionally absent —
 * equips are driven from Character.wz by `extractEquips`, and pets aren't
 * extracted yet.
 */
interface CategorySpec {
  /** Subdirectory under `Item.wz`. */
  itemDir: string;
  /** Candidate paths under `String.wz` that may carry localized strings.
   *  Tried in order — first hit wins. */
  stringRoots: string[];
  /** Value we store in `items.category`. */
  category: ItemRecord['category'];
}

const CATEGORIES: readonly CategorySpec[] = [
  {
    itemDir: 'Consume',
    stringRoots: ['String.wz/Consume.img'],
    category: 'use',
  },
  {
    itemDir: 'Etc',
    stringRoots: ['String.wz/Etc.img/Etc', 'String.wz/Etc.img'],
    category: 'etc',
  },
  {
    itemDir: 'Install',
    stringRoots: ['String.wz/Ins.img', 'String.wz/Install.img'],
    category: 'setup',
  },
  {
    itemDir: 'Cash',
    stringRoots: ['String.wz/Cash.img'],
    category: 'cash',
  },
];

export interface ExtractItemsResult {
  items: ItemRecord[];
  skipped: { reason: string; path: string }[];
}

interface WorkUnit {
  spec: CategorySpec;
  group: WzNodeInfo;
  ids: { id: number; node: WzNodeInfo }[];
}

/**
 * Walk `Item.wz`, decode each item's icon, join names + descriptions with
 * `String.wz`, and return normalized `ItemRecord`s for persistence.
 *
 * Progress is reported in two phases:
 *
 *   1. **Discovery** — list groups and count ids per group. Indeterminate
 *      (we don't know the total yet) but ticks per group so the bar moves.
 *      `parseImage()` runs here and caches; the extraction phase reuses that
 *      cache, so this isn't double work.
 *
 *   2. **Extraction** — determinate progress with current/total. The detail
 *      line carries the group + item-id currently being processed so the user
 *      can see exactly where we are. Icon decoding is the dominant per-item
 *      cost; throttling on the worker side keeps the message rate sane.
 */
export async function extractItems(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractItemsResult> {
  const items: ItemRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  // --- Phase 1: discovery -------------------------------------------------
  const work: WorkUnit[] = [];
  let total = 0;
  for (const spec of CATEGORIES) {
    const itemRoot = `Item.wz/${spec.itemDir}`;
    const groups = await source.listChildren(itemRoot);
    if (groups.length === 0) {
      log.debug('category absent or empty', { category: spec.category, path: itemRoot });
      continue;
    }
    for (const group of groups) {
      if (group.kind !== 'image') continue;
      opts.onProgress?.({
        phase: 'Discovering items',
        current: total,
        detail: `${spec.itemDir} / ${group.name}`,
      });
      const groupChildren = await source.listChildren(group.fullPath);
      const ids: WorkUnit['ids'] = [];
      for (const child of groupChildren) {
        const m = child.name.match(/^(\d+)$/);
        if (m) ids.push({ id: Number(m[1]), node: child });
      }
      work.push({ spec, group, ids });
      total += ids.length;
    }
  }
  log.info('discovery complete', { totalItems: total, groups: work.length });

  // --- Phase 2: extraction -----------------------------------------------
  let processed = 0;
  for (const { spec, group, ids } of work) {
    for (const { id, node } of ids) {
      opts.onProgress?.({
        phase: 'Extracting items',
        current: processed,
        total,
        detail: `${spec.itemDir} / ${group.name} · ${id}`,
      });
      const record = await readItem(source, id, node, spec, skipped);
      if (record) items.push(record);
      processed += 1;
    }
  }
  opts.onProgress?.({ phase: 'Extracting items', current: processed, total });

  log.info('extraction complete', { items: items.length, skipped: skipped.length });
  return { items, skipped };
}

async function readItem(
  source: GameDataSource,
  id: number,
  node: WzNodeInfo,
  spec: CategorySpec,
  skipped: { reason: string; path: string }[],
): Promise<ItemRecord | null> {
  const itemPath = node.fullPath;

  const info = {
    price: await scalarNumber(source, `${itemPath}/info/price`),
    slotMax: await scalarNumber(source, `${itemPath}/info/slotMax`),
    reqLevel: await scalarNumber(source, `${itemPath}/info/reqLevel`),
    icon: await source.getNode(`${itemPath}/info/icon`),
  };

  let name: string | null = null;
  let description: string | null = null;
  for (const root of spec.stringRoots) {
    const nameNode = await source.getNode(`${root}/${id}/name`);
    if (typeof nameNode?.scalar === 'string' && nameNode.scalar) {
      name = nameNode.scalar;
      const descNode = await source.getNode(`${root}/${id}/desc`);
      if (typeof descNode?.scalar === 'string') description = descNode.scalar;
      break;
    }
  }

  if (!name) {
    skipped.push({ reason: 'no localized name found', path: itemPath });
    return null;
  }

  const iconPath = info.icon ? `${itemPath}/info/icon` : null;
  const iconData = iconPath ? await source.getIconPng(iconPath) : null;

  return {
    id,
    name,
    description,
    category: spec.category,
    subcategory: null,
    iconPath,
    iconData,
    price: info.price,
    stackSize: info.slotMax,
    requiredLevel: info.reqLevel,
    sourcePath: itemPath,
  };
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
