// Consumable spec extractor.
//
// "use" items (Item.wz/Consume) carry a `/spec` subtree describing what
// consuming them does. The generic item extractor only reads `/info`, so this
// pass collects the spec fields into a sidecar record keyed by item id.
//
// Many consume items share one `.img` (0200.img holds 02000000, 02000001, …),
// so we read each group image once with `readImageTree` (one mutex acquisition)
// and walk every item's `spec` from the in-memory tree — no per-leaf getNode.
//
// Rows FK into `items`, so we mirror extractItems' skip rule: an item with no
// localized name never gets an items row, so we must not emit a spec row for it
// either, or the upsert hits a foreign-key violation.

import type { GameDataSource, WzNodeTree } from '../parser';
import type {
  ConsumableSpecRecord,
  MorphRandomEntry,
  SummonMobEntry,
} from '@scrolled/game-db/db';
import { createLogger, describeError } from '@scrolled/game-db/lib/logger';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';
import { childToNumber, childToString, indexChildrenByName, scalarToNumber } from './wzCoerce';
import { buildItemStringIndex } from './stringIndex';

const log = createLogger('extract-consumable-specs');

const CONSUME_ROOT = 'Item.wz/Consume';

export interface ExtractConsumableSpecsResult {
  specs: ConsumableSpecRecord[];
  skipped: { reason: string; path: string }[];
}

export async function extractConsumableSpecs(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractConsumableSpecsResult> {
  const specs: ConsumableSpecRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const groups = await source.listChildren(CONSUME_ROOT);
  if (groups.length === 0) {
    log.debug('Consume category absent or empty', { path: CONSUME_ROOT });
    return { specs, skipped };
  }

  const strings = await buildItemStringIndex(source);

  let processed = 0;
  for (const group of groups) {
    if (group.kind !== 'image') continue;
    opts.onProgress?.({ phase: 'Extracting consumable specs', current: processed, detail: group.name });

    // Depth 5 from the image reaches morphRandom's leaf children:
    // image(0) → item(1) → spec(2) → morphRandom(3) → entry(4) → morph/prop(5).
    let tree: WzNodeTree | null;
    try {
      tree = await source.readImageTree(group.fullPath, { maxDepth: 5 });
    } catch (err) {
      log.warn('failed to read group image', { path: group.fullPath, ...describeError(err) });
      skipped.push({ reason: 'image read error', path: group.fullPath });
      continue;
    }
    if (!tree) continue;

    for (const itemNode of tree.children) {
      const m = itemNode.name.match(/^(\d+)$/);
      if (!m) continue;
      const id = Number(m[1]);
      const children = indexChildrenByName(itemNode.children);
      const specNode = children.get('spec');
      // Summoning sacks keep their spawn table in an item-level `mob` node,
      // a sibling of `spec`. Items with only that (no spec) still get a row.
      const summonMobNode = children.get('mob');
      if (!specNode && !summonMobNode) continue;
      processed += 1;
      if (!strings.get(id)?.name) {
        // Mirrors extractItems' skip — no items row would exist for the FK.
        skipped.push({ reason: 'no localized name found', path: itemNode.fullPath });
        continue;
      }
      const record = buildSpecRecord(id, specNode, summonMobNode);
      if (record) specs.push(record);
    }
  }
  opts.onProgress?.({ phase: 'Extracting consumable specs', current: processed });

  log.info('consumable spec extraction complete', { specs: specs.length, skipped: skipped.length });
  return { specs, skipped };
}

/** Build a record from an item's `spec` node and/or its summon-sack `mob`
 *  node. Returns null when neither carries a field we keep. */
function buildSpecRecord(
  itemId: number,
  spec: WzNodeTree | undefined,
  summonMobNode: WzNodeTree | undefined,
): ConsumableSpecRecord | null {
  const record: ConsumableSpecRecord = {
    itemId,
    hp: childToNumber(spec, 'hp'),
    mp: childToNumber(spec, 'mp'),
    hpR: childToNumber(spec, 'hpR'),
    mpR: childToNumber(spec, 'mpR'),
    mhp: childToNumber(spec, 'mhp'),
    mhpR: childToNumber(spec, 'mhpR'),
    mmpR: childToNumber(spec, 'mmpR'),
    mhpRRate: childToNumber(spec, 'mhpRRate'),
    mmpRRate: childToNumber(spec, 'mmpRRate'),
    time: childToNumber(spec, 'time'),
    pad: childToNumber(spec, 'pad'),
    mad: childToNumber(spec, 'mad'),
    pdd: childToNumber(spec, 'pdd'),
    mdd: childToNumber(spec, 'mdd'),
    acc: childToNumber(spec, 'acc'),
    eva: childToNumber(spec, 'eva'),
    speed: childToNumber(spec, 'speed'),
    jump: childToNumber(spec, 'jump'),
    luk: childToNumber(spec, 'luk'),
    padRate: childToNumber(spec, 'padRate'),
    madRate: childToNumber(spec, 'madRate'),
    pddRate: childToNumber(spec, 'pddRate'),
    mddRate: childToNumber(spec, 'mddRate'),
    accRate: childToNumber(spec, 'accRate'),
    evaRate: childToNumber(spec, 'evaRate'),
    speedRate: childToNumber(spec, 'speedRate'),
    curse: childToNumber(spec, 'curse'),
    darkness: childToNumber(spec, 'darkness'),
    poison: childToNumber(spec, 'poison'),
    seal: childToNumber(spec, 'seal'),
    weakness: childToNumber(spec, 'weakness'),
    thaw: childToNumber(spec, 'thaw'),
    barrier: childToNumber(spec, 'barrier'),
    respectPimmune: childToNumber(spec, 'respectPimmune'),
    respectMimmune: childToNumber(spec, 'respectMimmune'),
    respectFs: childToNumber(spec, 'respectFS'),
    defenseAtt: childToString(spec, 'defenseAtt'),
    defenseState: childToString(spec, 'defenseState'),
    prob: childToNumber(spec, 'prob'),
    itemupbyitem: childToNumber(spec, 'itemupbyitem'),
    mesoupbyitem: childToNumber(spec, 'mesoupbyitem'),
    itemCode: childToNumber(spec, 'itemCode'),
    itemRange: childToNumber(spec, 'itemRange'),
    morph: childToNumber(spec, 'morph'),
    ghost: childToNumber(spec, 'ghost'),
    moveTo: childToNumber(spec, 'moveTo'),
    returnMapQr: childToNumber(spec, 'returnMapQR'),
    ignoreContinent: childToNumber(spec, 'ignoreContinent'),
    randomMoveInFieldSet: childToNumber(spec, 'randomMoveInFieldSet'),
    npc: childToNumber(spec, 'npc'),
    attackMobId: childToNumber(spec, 'attackMobID'),
    attackIndex: childToNumber(spec, 'attackIndex'),
    inc: childToNumber(spec, 'inc'),
    incFatigue: childToNumber(spec, 'incFatigue'),
    exp: childToNumber(spec, 'exp'),
    expinc: childToNumber(spec, 'expinc'),
    expBuff: childToNumber(spec, 'expBuff'),
    maxLevelBuff: childToNumber(spec, 'maxLevelBuff'),
    cp: childToNumber(spec, 'cp'),
    eventPoint: childToNumber(spec, 'eventPoint'),
    eventRate: childToNumber(spec, 'eventRate'),
    consumeOnPickup: childToNumber(spec, 'consumeOnPickup'),
    onlyPickup: childToNumber(spec, 'onlyPickup'),
    runOnPickup: childToNumber(spec, 'runOnPickup'),
    repeatEffect: childToNumber(spec, 'repeatEffect'),
    otherParty: childToNumber(spec, 'otherParty'),
    party: childToNumber(spec, 'party'),
    mob: readMobList(spec),
    morphRandom: readMorphRandom(spec),
    skillbook: readSkillbook(spec),
    summonMobs: readSummonMobs(summonMobNode),
  };

  return hasAnyField(record) ? record : null;
}

/** Summoning-sack spawn table: `mob/<idx>/{ id, prob }`. */
function readSummonMobs(node: WzNodeTree | undefined): SummonMobEntry[] | null {
  if (!node) return null;
  const entries: SummonMobEntry[] = [];
  for (const entry of node.children) {
    const mobId = childToNumber(entry, 'id');
    if (mobId !== null) entries.push({ mobId, prob: childToNumber(entry, 'prob') ?? 100 });
  }
  return entries.length > 0 ? entries : null;
}

/** `spec/mob` — a SubProperty whose children are Int leaves holding mob ids. */
function readMobList(spec: WzNodeTree | undefined): number[] | null {
  if (!spec) return null;
  const node = indexChildrenByName(spec.children).get('mob');
  if (!node) return null;
  const ids = node.children
    .map((c) => scalarToNumber(c.scalar))
    .filter((n): n is number => n !== null);
  return ids.length > 0 ? ids : null;
}

/** `morphRandom` — a SubProperty of `{ morph, prop }` entries. */
function readMorphRandom(spec: WzNodeTree | undefined): MorphRandomEntry[] | null {
  if (!spec) return null;
  const node = indexChildrenByName(spec.children).get('morphRandom');
  if (!node) return null;
  const entries: MorphRandomEntry[] = [];
  for (const child of node.children) {
    const morph = childToNumber(child, 'morph');
    const prop = childToNumber(child, 'prop');
    if (morph !== null) entries.push({ morph, prop: prop ?? 0 });
  }
  return entries.length > 0 ? entries : null;
}

/** Mastery-book skill ids: spec's numeric-named children (`0`–`9`). */
function readSkillbook(spec: WzNodeTree | undefined): number[] | null {
  if (!spec) return null;
  const ids = spec.children
    .filter((c) => /^\d+$/.test(c.name))
    .sort((a, b) => Number(a.name) - Number(b.name))
    .map((c) => scalarToNumber(c.scalar))
    .filter((n): n is number => n !== null);
  return ids.length > 0 ? ids : null;
}

function hasAnyField(record: ConsumableSpecRecord): boolean {
  return Object.entries(record).some(([key, value]) => key !== 'itemId' && value !== null);
}
