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
 * their full stat blocks live in Character.wz / String.wz/Eqp.img and are
 * handled by separate extractors.
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

/**
 * Walk `Item.wz` (one category at a time) and produce normalized `ItemRecord`s
 * with names + descriptions resolved through `String.wz`. The caller is
 * responsible for persisting the result.
 *
 * Progress is indeterminate by item count (the total isn't knowable without
 * walking everything first, which costs the same as the actual extraction)
 * but each tick carries the current category + group so the UI can show
 * "Items · use — Consume / 0200.img".
 */
export async function extractItems(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractItemsResult> {
  const items: ItemRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

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
        phase: `Items · ${spec.category}`,
        current: items.length,
        detail: `${spec.itemDir} / ${group.name}`,
      });
      const groupChildren = await source.listChildren(group.fullPath);
      log.debug('walking group', {
        category: spec.category,
        group: group.name,
        idCount: groupChildren.length,
      });

      for (const child of groupChildren) {
        const idMatch = child.name.match(/^(\d+)$/);
        if (!idMatch) continue;
        const id = Number(idMatch[1]);

        const record = await readItem(source, id, child, spec, skipped);
        if (record) items.push(record);
      }

      opts.onProgress?.({
        phase: `Items · ${spec.category}`,
        current: items.length,
        detail: `${spec.itemDir} / ${group.name}`,
      });
    }
  }

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

  // Localized strings. Different categories nest differently in String.wz;
  // try each candidate root.
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

  return {
    id,
    name,
    description,
    category: spec.category,
    subcategory: null,
    iconPath: info.icon ? `${itemPath}/info/icon` : null,
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
