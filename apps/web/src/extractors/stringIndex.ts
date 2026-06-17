import type { GameDataSource, WzNodeTree } from '@/parser';
import { createLogger } from '@/lib/logger';
import { unescapeWzString } from './wzText';

const log = createLogger('string-index');

/**
 * One entity's localized strings, resolved by ID rather than by where the
 * node happened to sit in `String.wz`. `raw` carries every direct string
 * child verbatim so callers can read entity-specific fields (`func`, `h`,
 * `mapName`, `summary`, …) without a second lookup. `name`/`desc` surface the
 * two conventional fields; `desc` is unescaped to match what the UI renders.
 */
export interface StringEntry {
  id: number;
  /** Where the winning node lives, e.g. "String.wz/Eqp.img/Eqp/Accessory/1112400". */
  path: string;
  /** Immediate bucket node (slot for equips, region for maps, item category); null at the image root. */
  category: string | null;
  name: string | null;
  desc: string | null;
  raw: Record<string, string>;
}

export type StringIndex = Map<number, StringEntry>;

/** A node name that is purely numeric (the entity ID), tolerating zero-padding. */
const NUMERIC = /^0*(\d+)$/;

const stripImg = (name: string): string => name.replace(/\.img$/, '');

/**
 * Collect every direct string-valued child of an entity node into a flat
 * record. Sparse entries (name only) and entries with unknown extra fields
 * are kept as-is — the index never rejects an entry for shape.
 */
export function parseStringEntry(
  node: WzNodeTree,
  ctx: { path: string; category: string | null },
): StringEntry {
  const raw: Record<string, string> = {};
  for (const child of node.children) {
    if (typeof child.scalar === 'string') raw[child.name] = child.scalar;
  }
  return {
    id: Number(NUMERIC.exec(node.name)![1]),
    path: ctx.path,
    category: ctx.category,
    name: raw.name ?? null,
    desc: raw.desc != null ? unescapeWzString(raw.desc) : null,
    raw,
  };
}

/**
 * Walk a `String.wz` image tree and surface every numeric-named node as an
 * entity entry, regardless of how deep its bucket nesting goes. Non-numeric
 * nodes (the `Eqp` wrapper, slot/category/region buckets) are descended
 * into; the first numeric node on a branch is the entity and is not walked
 * further. This is what makes resolution position-independent: we trust the
 * IDs the file actually contains instead of an expected path.
 */
function collectEntries(node: WzNodeTree, into: (entry: StringEntry) => void): void {
  for (const child of node.children) {
    if (NUMERIC.test(child.name)) {
      into(parseStringEntry(child, { path: child.fullPath, category: stripImg(node.name) }));
    } else {
      collectEntries(child, into);
    }
  }
}

/**
 * Resolve duplicate IDs deterministically: prefer an entry carrying both name
 * and desc, then one with a name, else the first discovered. Builders add
 * higher-priority sources first, so "first discovered" already encodes source
 * preference. Duplicates are logged so extractor gaps surface in bug reports.
 */
function resolveCandidates(candidates: Map<number, StringEntry[]>): StringIndex {
  const out: StringIndex = new Map();
  for (const [id, list] of candidates) {
    const selected =
      list.find((e) => e.name && e.desc) ?? list.find((e) => e.name) ?? list[0]!;
    if (list.length > 1) {
      log.warn('duplicate string entries', {
        id,
        candidates: list.map((c) => c.path),
        selected: selected.path,
      });
    }
    out.set(id, selected);
  }
  return out;
}

/** Read one image tree and fold its numeric entries into `candidates`. */
async function foldImage(
  source: GameDataSource,
  imagePath: string,
  maxDepth: number,
  candidates: Map<number, StringEntry[]>,
): Promise<boolean> {
  const tree = await source.readImageTree(imagePath, { maxDepth });
  if (!tree) return false;
  collectEntries(tree, (entry) => {
    const list = candidates.get(entry.id);
    if (list) list.push(entry);
    else candidates.set(entry.id, [entry]);
  });
  return true;
}

/**
 * Equip strings live under `String.wz/Eqp.img/Eqp/<slot>/<id>`, but the slot
 * bucket does NOT mirror Character.wz's directory layout — rings, pendants,
 * belts, medals and eye/face accessories all sit under a single `Accessory`
 * bucket while Character.wz splits them into `Ring`, `Pendant`, … . Indexing
 * by ID across every bucket is what lets `extractEquips` resolve e.g. Ring of
 * Alchemist (1112400) regardless of the slot mismatch.
 */
export async function buildEquipStringIndex(source: GameDataSource): Promise<StringIndex> {
  const candidates = new Map<number, StringEntry[]>();
  // Eqp.img(0) -> Eqp(1) -> slot(2) -> id(3) -> {name,desc}(4)
  if (!(await foldImage(source, 'String.wz/Eqp.img', 4, candidates))) {
    log.warn('String.wz/Eqp.img not found — equip names will be empty');
  }
  return resolveCandidates(candidates);
}

/**
 * Non-equip item strings. Layouts vary by dump: most ship separate top-level
 * images (`Consume.img`, `Etc.img/Etc`, `Ins.img`, `Cash.img`, `Pet.img`),
 * some nest everything under `Item.img/<category>`. We walk whichever images
 * are present and trust the numeric children — no per-category path is
 * assumed. Item *classification* (the `items.category` value) stays in
 * `extractItems`; this only answers "what text exists for this ID?".
 */
const ITEM_STRING_IMAGES = [
  'Consume.img',
  'Etc.img',
  'Ins.img',
  'Install.img',
  'Cash.img',
  'Pet.img',
  'Item.img',
];

export async function buildItemStringIndex(source: GameDataSource): Promise<StringIndex> {
  const present = new Set((await source.listChildren('String.wz')).map((n) => n.name));
  const candidates = new Map<number, StringEntry[]>();
  for (const img of ITEM_STRING_IMAGES) {
    if (!present.has(img)) continue;
    // Deepest layout is Item.img(0) -> category(1) -> id(2) -> {name,desc}(3).
    await foldImage(source, `String.wz/${img}`, 4, candidates);
  }
  return resolveCandidates(candidates);
}

/** `String.wz/Mob.img/<id>/name`. */
export async function buildMobStringIndex(source: GameDataSource): Promise<StringIndex> {
  const candidates = new Map<number, StringEntry[]>();
  await foldImage(source, 'String.wz/Mob.img', 2, candidates);
  return resolveCandidates(candidates);
}

/** `String.wz/Npc.img/<id>/{name,func}` — `func` is the role descriptor. */
export async function buildNpcStringIndex(source: GameDataSource): Promise<StringIndex> {
  const candidates = new Map<number, StringEntry[]>();
  await foldImage(source, 'String.wz/Npc.img', 2, candidates);
  return resolveCandidates(candidates);
}

/** `String.wz/Skill.img/<id>/{name,desc,h,h1,h2,…}` — per-level `hN` land in `raw`. */
export async function buildSkillStringIndex(source: GameDataSource): Promise<StringIndex> {
  const candidates = new Map<number, StringEntry[]>();
  await foldImage(source, 'String.wz/Skill.img', 2, candidates);
  return resolveCandidates(candidates);
}

/** `String.wz/Map.img/<region>/<id>/{mapName,streetName}` — read from `raw`. */
export async function buildMapStringIndex(source: GameDataSource): Promise<StringIndex> {
  const candidates = new Map<number, StringEntry[]>();
  if (!(await foldImage(source, 'String.wz/Map.img', 3, candidates))) {
    log.warn('String.wz/Map.img not found — map names will be empty');
  }
  return resolveCandidates(candidates);
}

/**
 * Quest strings sit in one of two places depending on the dump, in this
 * precedence: `String.wz/Quest.img/<id>/{name,parent,desc}` (vanilla), then
 * `Quest.wz/QuestInfo.img/<id>/{name,parent,summary}` (private-server dumps
 * that strip the String.wz copy — note the different *file*, and `summary` in
 * place of `desc`). String.wz is folded first so `resolveCandidates` prefers
 * it when both exist.
 */
export async function buildQuestStringIndex(source: GameDataSource): Promise<StringIndex> {
  const present = new Set((await source.listChildren('String.wz')).map((n) => n.name));
  const candidates = new Map<number, StringEntry[]>();
  if (present.has('Quest.img')) {
    await foldImage(source, 'String.wz/Quest.img', 2, candidates);
  }
  await foldImage(source, 'Quest.wz/QuestInfo.img', 2, candidates);
  return resolveCandidates(candidates);
}
