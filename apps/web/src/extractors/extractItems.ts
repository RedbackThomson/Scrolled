import type { GameDataSource, WzNodeInfo } from '@/parser';
import { nodeToNumber } from './wzCoerce';
import type { ItemRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';
import { unescapeWzString } from './wzText';

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

  // --- Step 1: discovery --------------------------------------------------
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

  // --- Step 2: extraction -------------------------------------------------
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

  // One listChildren call pulls the whole `info` subtree (scalars included)
  // in a single round-trip, rather than a getNode per property.
  const info = new Map<string, WzNodeInfo>();
  for (const child of await source.listChildren(`${itemPath}/info`)) info.set(child.name, child);

  let name: string | null = null;
  let description: string | null = null;
  for (const root of spec.stringRoots) {
    const nameNode = await source.getNode(`${root}/${id}/name`);
    if (typeof nameNode?.scalar === 'string' && nameNode.scalar) {
      name = nameNode.scalar;
      const descNode = await source.getNode(`${root}/${id}/desc`);
      if (typeof descNode?.scalar === 'string') description = unescapeWzString(descNode.scalar);
      break;
    }
  }

  if (!name) {
    skipped.push({ reason: 'no localized name found', path: itemPath });
    return null;
  }

  const iconPath = info.has('icon') ? `${itemPath}/info/icon` : null;
  const iconData = iconPath ? await source.getIconPng(iconPath) : null;

  return {
    id,
    name,
    description,
    category: spec.category,
    subcategory: null,
    iconPath,
    iconData,
    price: nodeToNumber(info.get('price')),
    stackSize: nodeToNumber(info.get('slotMax')),
    requiredLevel: nodeToNumber(info.get('reqLevel')),
    cash: nodeToNumber(info.get('cash')) === 1,
    tradeBlock: nodeToNumber(info.get('tradeBlock')) === 1,
    accountSharable: nodeToNumber(info.get('accountSharable')) === 1,
    only: nodeToNumber(info.get('only')) === 1,
    quest: nodeToNumber(info.get('quest')) === 1,
    timeLimited: nodeToNumber(info.get('timeLimited')) === 1,
    expireOnLogout: nodeToNumber(info.get('expireOnLogout')) === 1,
    pickupBlock: nodeToNumber(info.get('pickupBlock')) === 1,
    notSale: nodeToNumber(info.get('notSale')) === 1,
    dropBlock: nodeToNumber(info.get('dropBlock')) === 1,
    tradeAvailable: nodeToNumber(info.get('tradeAvailable')) === 1,
    sourcePath: itemPath,
  };
}
