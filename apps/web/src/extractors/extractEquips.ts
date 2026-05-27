import type { GameDataSource, WzNodeTree } from '@/parser';
import { nodeToNumber } from './wzCoerce';
import type { EquipRecord } from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';
import { unescapeWzString } from './wzText';
import { normalizeEquipSlot, resolveEquipType } from '@/domain/equipTypes';

const log = createLogger('extract-equips');

export interface ExtractEquipsResult {
  equips: EquipRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Character.wz top-level directories that hold non-equip data (skin tones,
 * hair styles, face items, etc.). We skip them during the walk so we don't
 * try to look up equip names for them in `String.wz/Eqp.img/Eqp`.
 *
 * Anything not on this list is assumed to be an equip slot. If a new slot
 * appears in a future WZ version, it'll be picked up automatically.
 */
const NON_EQUIP_DIRS = new Set([
  'Hair',
  'Face',
  'Skin',
  'Afterimage',
  'Familiar',
  'Mob',
  'Mount',
  'Cmount',
  'Effect',
  'Wedding',
]);

/**
 * Slot-name aliases between Character.wz and String.wz/Eqp.img/Eqp. WZ
 * versions disagree on a few (e.g. "TamingMob" in Character.wz vs "Taming"
 * in String.wz). Maps Character.wz dir name → String.wz/Eqp.img/Eqp dir
 * name; anything not listed is matched 1:1.
 */
const SLOT_ALIASES: Record<string, string> = {
  TamingMob: 'Taming',
};

/**
 * Extract equip records from `Character.wz`, joined with localized names
 * from `String.wz/Eqp.img/Eqp`. Each `<Slot>/<paddedId>.img/info` subtree
 * carries the stat block (incPAD, reqLevel, tuc, …) and the icon canvas;
 * we read the whole `info` subtree in one `readImageTree` call per equip
 * rather than walking each property individually.
 *
 * Progress: discovery first (count ids per slot), then determinate
 * progress with `current / total` and the slot + id in the detail line.
 *
 * Equips with no localized name are skipped (consistent with extractItems).
 */
export async function extractEquips(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractEquipsResult> {
  const equips: EquipRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const characterRoot = 'Character.wz';
  const topDirs = await source.listChildren(characterRoot);
  if (topDirs.length === 0) {
    log.warn('Character.wz not loaded — skipping equip extraction', { path: characterRoot });
    return { equips, skipped };
  }

  // --- Discovery --------------------------------------------------------
  interface WorkUnit {
    /** Original case from Character.wz (e.g. "Cap", "TamingMob"). */
    characterSlot: string;
    /** String.wz slot key (after alias mapping). */
    stringSlot: string;
    id: number;
    imagePath: string;
  }
  const work: WorkUnit[] = [];

  for (const slotDir of topDirs) {
    if (slotDir.kind !== 'directory') continue;
    if (NON_EQUIP_DIRS.has(slotDir.name)) continue;
    const stringSlot = SLOT_ALIASES[slotDir.name] ?? slotDir.name;
    opts.onProgress?.({
      phase: 'Discovering equips',
      current: work.length,
      detail: slotDir.name,
    });
    const entries = await source.listChildren(slotDir.fullPath);
    for (const entry of entries) {
      if (entry.kind !== 'image') continue;
      const m = entry.name.match(/^0*(\d+)\.img$/);
      if (!m) continue;
      work.push({
        characterSlot: slotDir.name,
        stringSlot,
        id: Number(m[1]!),
        imagePath: entry.fullPath,
      });
    }
  }
  log.info('discovery complete', { totalEquips: work.length });

  // --- Extraction -------------------------------------------------------
  const total = work.length;
  let processed = 0;
  for (const w of work) {
    opts.onProgress?.({
      phase: 'Extracting equips',
      current: processed,
      total,
      detail: `${w.characterSlot} · ${w.id}`,
    });

    const name = await readScalarString(
      source,
      `String.wz/Eqp.img/Eqp/${w.stringSlot}/${w.id}/name`,
    );
    if (!name) {
      skipped.push({ reason: 'no localized name', path: w.imagePath });
      processed += 1;
      continue;
    }
    const description = unescapeWzString(
      await readScalarString(source, `String.wz/Eqp.img/Eqp/${w.stringSlot}/${w.id}/desc`),
    );
    const info = await readInfo(source, w.imagePath);
    const slotKey = normalizeEquipSlot(w.stringSlot);
    const iconPath = info.hasIcon ? `${w.imagePath}/info/icon` : null;
    const iconData = iconPath ? await source.getIconPng(iconPath) : null;

    equips.push({
      id: w.id,
      name,
      description,
      slot: slotKey,
      category: slotKey,
      requiredLevel: info.reqLevel,
      requiredStr: info.reqSTR,
      requiredDex: info.reqDEX,
      requiredInt: info.reqINT,
      requiredLuk: info.reqLUK,
      requiredJob: info.reqJob,
      attack: info.incPAD,
      magicAttack: info.incMAD,
      defense: info.incPDD,
      magicDefense: info.incMDD,
      accuracy: info.incACC,
      avoidability: info.incEVA,
      upgradeSlots: info.tuc,
      incStr: info.incSTR,
      incDex: info.incDEX,
      incInt: info.incINT,
      incLuk: info.incLUK,
      incHp: info.incMHP,
      incMp: info.incMMP,
      incSpeed: info.incSpeed,
      incJump: info.incJump,
      cash: info.cash === 1,
      equipType: resolveEquipType(w.id),
      tradeBlock: info.tradeBlock === 1,
      equipTradeBlock: info.equipTradeBlock === 1,
      accountSharable: info.accountSharable === 1,
      only: info.only === 1,
      quest: info.quest === 1,
      timeLimited: info.timeLimited === 1,
      expireOnLogout: info.expireOnLogout === 1,
      pickupBlock: info.pickupBlock === 1,
      notSale: info.notSale === 1,
      iconPath,
      iconData,
      sourcePath: w.imagePath,
    });
    processed += 1;
  }
  opts.onProgress?.({ phase: 'Extracting equips', current: processed, total });

  log.info('equip extraction complete', { count: equips.length, skipped: skipped.length });
  return { equips, skipped };
}

interface EquipInfo {
  hasIcon: boolean;
  reqLevel: number | null;
  reqSTR: number | null;
  reqDEX: number | null;
  reqINT: number | null;
  reqLUK: number | null;
  reqJob: number | null;
  incPAD: number | null;
  incMAD: number | null;
  incPDD: number | null;
  incMDD: number | null;
  incACC: number | null;
  incEVA: number | null;
  incSTR: number | null;
  incDEX: number | null;
  incINT: number | null;
  incLUK: number | null;
  incMHP: number | null;
  incMMP: number | null;
  incSpeed: number | null;
  incJump: number | null;
  tuc: number | null;
  /** 1 = cash-shop cosmetic, 0 / absent = regular in-game equip. */
  cash: number | null;
  tradeBlock: number | null;
  equipTradeBlock: number | null;
  accountSharable: number | null;
  only: number | null;
  quest: number | null;
  timeLimited: number | null;
  expireOnLogout: number | null;
  pickupBlock: number | null;
  notSale: number | null;
}

const EMPTY_INFO: EquipInfo = {
  hasIcon: false,
  reqLevel: null,
  reqSTR: null,
  reqDEX: null,
  reqINT: null,
  reqLUK: null,
  reqJob: null,
  incPAD: null,
  incMAD: null,
  incPDD: null,
  incMDD: null,
  incACC: null,
  incEVA: null,
  incSTR: null,
  incDEX: null,
  incINT: null,
  incLUK: null,
  incMHP: null,
  incMMP: null,
  incSpeed: null,
  incJump: null,
  tuc: null,
  cash: null,
  tradeBlock: null,
  equipTradeBlock: null,
  accountSharable: null,
  only: null,
  quest: null,
  timeLimited: null,
  expireOnLogout: null,
  pickupBlock: null,
  notSale: null,
};

async function readInfo(source: GameDataSource, imagePath: string): Promise<EquipInfo> {
  // One readImageTree call pulls the entire `info` subtree in one lock
  // acquisition. Avoids ~15 round-trips per equip.
  const tree = await source.readImageTree(imagePath, { subtrees: ['info'], maxDepth: 3 });
  if (!tree) return EMPTY_INFO;
  const info = tree.children.find((c) => c.name === 'info');
  if (!info) return EMPTY_INFO;
  const map = new Map<string, WzNodeTree>();
  for (const child of info.children) map.set(child.name, child);
  return {
    hasIcon: map.has('icon'),
    reqLevel: nodeToNumber(map.get('reqLevel')),
    reqSTR: nodeToNumber(map.get('reqSTR')),
    reqDEX: nodeToNumber(map.get('reqDEX')),
    reqINT: nodeToNumber(map.get('reqINT')),
    reqLUK: nodeToNumber(map.get('reqLUK')),
    reqJob: nodeToNumber(map.get('reqJob')),
    incPAD: nodeToNumber(map.get('incPAD')),
    incMAD: nodeToNumber(map.get('incMAD')),
    incPDD: nodeToNumber(map.get('incPDD')),
    incMDD: nodeToNumber(map.get('incMDD')),
    incACC: nodeToNumber(map.get('incACC')),
    incEVA: nodeToNumber(map.get('incEVA')),
    incSTR: nodeToNumber(map.get('incSTR')),
    incDEX: nodeToNumber(map.get('incDEX')),
    incINT: nodeToNumber(map.get('incINT')),
    incLUK: nodeToNumber(map.get('incLUK')),
    incMHP: nodeToNumber(map.get('incMHP')),
    incMMP: nodeToNumber(map.get('incMMP')),
    incSpeed: nodeToNumber(map.get('incSpeed')),
    incJump: nodeToNumber(map.get('incJump')),
    tuc: nodeToNumber(map.get('tuc')),
    cash: nodeToNumber(map.get('cash')),
    tradeBlock: nodeToNumber(map.get('tradeBlock')),
    equipTradeBlock: nodeToNumber(map.get('equipTradeBlock')),
    accountSharable: nodeToNumber(map.get('accountSharable')),
    only: nodeToNumber(map.get('only')),
    quest: nodeToNumber(map.get('quest')),
    timeLimited: nodeToNumber(map.get('timeLimited')),
    expireOnLogout: nodeToNumber(map.get('expireOnLogout')),
    pickupBlock: nodeToNumber(map.get('pickupBlock')),
    notSale: nodeToNumber(map.get('notSale')),
  };
}

async function readScalarString(source: GameDataSource, path: string): Promise<string | null> {
  const node = await source.getNode(path);
  if (typeof node?.scalar === 'string' && node.scalar) return node.scalar;
  return null;
}
