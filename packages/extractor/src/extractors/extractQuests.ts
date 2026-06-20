import type { GameDataSource } from '../parser';
import { pathToNumber, scalarToNumber } from './wzCoerce';
import type { QuestRecord, QuestRequirementRecord, QuestRewardRecord } from '@scrolled/game-db/db';
import { createLogger } from '@scrolled/game-db/lib/logger';
import type { ProgressFn } from '@scrolled/game-db/lib/progress';
import { unescapeWzString } from './wzText';
import { buildQuestStringIndex } from './stringIndex';

const log = createLogger('extract-quests');

export interface ExtractQuestsResult {
  quests: QuestRecord[];
  requirements: QuestRequirementRecord[];
  rewards: QuestRewardRecord[];
  skipped: { reason: string; path: string }[];
  /**
   * Count of quests whose names fell back to `Quest <id>` because neither
   * `String.wz/Quest.img/<id>/name` nor `Quest.wz/QuestInfo.img/<id>/name`
   * produced a string. Surfaced in extraction reports so the user can see
   * data-quality issues at a glance.
   */
  placeholderNames: number;
}

/**
 * Walk `Quest.wz` and emit normalized quest records.
 *
 * Source layout (v83 GMS / MapleRoyals):
 *
 *   Quest.wz/
 *     Check.img/<questId>/0/...   start requirements
 *     Check.img/<questId>/1/...   completion requirements
 *     Act.img/<questId>/0/...     start actions (rare; rewards skipped here)
 *     Act.img/<questId>/1/...     completion actions (rewards)
 *     QuestInfo.img/<questId>/... metadata (autoStart, area, etc.; mostly ignored)
 *
 *   String.wz/
 *     Quest.img/<questId>/name    display name
 *     Quest.img/<questId>/parent  area / chain
 *     Quest.img/<questId>/desc    blurb (sometimes missing)
 *
 * We iterate `Check.img` because that's the set of quests with playable
 * logic — quests in `QuestInfo.img` without a Check.img sibling are typically
 * legacy or cosmetic entries. Quests without a localized name in String.wz
 * are skipped so the UI never renders a nameless row.
 */
export async function extractQuests(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractQuestsResult> {
  const quests: QuestRecord[] = [];
  const requirements: QuestRequirementRecord[] = [];
  const rewards: QuestRewardRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const checkChildren = await source.listChildren('Quest.wz/Check.img');
  if (checkChildren.length === 0) {
    const top = await source.listChildren('Quest.wz');
    log.warn('Quest.wz/Check.img absent or empty', {
      questWzTopLevel: top.map((n) => `${n.name} (${n.kind})`),
      hint:
        top.length === 0
          ? 'Quest.wz appears to have failed to load — check parser.load errors.'
          : 'Quest.wz loaded but has no Check.img; layout may differ from v83.',
    });
    return { quests, requirements, rewards, skipped, placeholderNames: 0 };
  }

  const total = checkChildren.length;
  log.info('discovery complete', { totalQuests: total });

  // Quest strings live in one of two places depending on the dump:
  //   A) `String.wz/Quest.img/<id>/{name,parent,desc}` — standard v83
  //      layout, present in vanilla Nexon dumps.
  //   B) `Quest.wz/QuestInfo.img/<id>/{name,parent,summary}` — used by
  //      private-server dumps (MapleRoyals included) that strip the
  //      String.wz copy. The fields are equivalent semantically but
  //      `desc` becomes `summary`.
  //
  // The index folds (A) first so it wins when both carry a name; quests
  // resolved only via (B) fall back to it. Any quest still without a name
  // keeps `Quest <id>` as a placeholder so its requirements / rewards
  // remain navigable.
  const strings = await buildQuestStringIndex(source);
  if (strings.size === 0) {
    log.warn('no quest name source found — quest names will be placeholders', {
      hint: 'Neither String.wz/Quest.img nor Quest.wz/QuestInfo.img/<id> was readable. Quests still extract by ID; the UI will display "Quest <id>".',
    });
  }

  let processed = 0;
  let namesFromStringWz = 0;
  let namesFromQuestInfo = 0;
  let placeholderNames = 0;
  for (const entry of checkChildren) {
    const m = entry.name.match(/^(\d+)$/);
    if (!m) {
      processed += 1;
      continue;
    }
    const id = Number(m[1]);

    opts.onProgress?.({
      phase: 'Extracting quests',
      current: processed,
      total,
      detail: String(id),
    });

    // The index resolves String.wz/Quest.img over Quest.wz/QuestInfo.img;
    // `summary` is QuestInfo's analog of String.wz/Quest.img's `desc`.
    const strEntry = strings.get(id);
    let name = `Quest ${id}`;
    const parent: string | null = strEntry?.raw.parent ?? null;
    const description: string | null =
      strEntry?.desc ?? unescapeWzString(strEntry?.raw.summary ?? null);
    if (strEntry?.name) {
      name = strEntry.name;
      if (strEntry.path.startsWith('String.wz/')) namesFromStringWz += 1;
      else namesFromQuestInfo += 1;
    } else {
      placeholderNames += 1;
    }

    // -- Check.img/<id>/0 (start) ---------------------------------------
    const startPath = `${entry.fullPath}/0`;
    const [startNpcN, lvMinN, jobN] = await Promise.all([
      pathToNumber(source, `${startPath}/npc`),
      pathToNumber(source, `${startPath}/lvmin`),
      pathToNumber(source, `${startPath}/job`),
    ]);
    await collectQuestPrereqs(source, `${startPath}/quest`, id, requirements);
    if (lvMinN !== null) {
      requirements.push({ questId: id, kind: 'level', targetId: null, amount: lvMinN });
    }
    if (jobN !== null && jobN > 0) {
      requirements.push({ questId: id, kind: 'job', targetId: null, amount: jobN });
    }

    // -- Check.img/<id>/1 (completion) ----------------------------------
    const endPath = `${entry.fullPath}/1`;
    const endNpcN = await pathToNumber(source, `${endPath}/npc`);
    await collectItemReqs(source, `${endPath}/item`, id, requirements);
    await collectMobReqs(source, `${endPath}/mob`, id, requirements);

    // Absence of the attribute is what marks the quest as not repeatable.
    const repeatWait = await pathToNumber(source, `Quest.wz/QuestInfo.img/${id}/repeatWait`);

    // -- Act.img/<id>/1 (completion rewards) ----------------------------
    const actEndPath = `Quest.wz/Act.img/${id}/1`;
    const [expN, mesoN, spN, fameN, buffN, skillN] = await Promise.all([
      pathToNumber(source, `${actEndPath}/exp`),
      // The game files use either `money` or `meso` depending on era.
      pickFirstNumber(source, [`${actEndPath}/money`, `${actEndPath}/meso`]),
      pathToNumber(source, `${actEndPath}/sp`),
      // `pop` is the WZ key for fame.
      pathToNumber(source, `${actEndPath}/pop`),
      pathToNumber(source, `${actEndPath}/buffItemID`),
      pathToNumber(source, `${actEndPath}/skill`),
    ]);
    if (expN !== null && expN !== 0) {
      rewards.push(scalarReward(id, 'exp', expN));
    }
    if (mesoN !== null && mesoN !== 0) {
      rewards.push(scalarReward(id, 'meso', mesoN));
    }
    if (spN !== null && spN !== 0) {
      rewards.push(scalarReward(id, 'sp', spN));
    }
    if (fameN !== null && fameN !== 0) {
      rewards.push(scalarReward(id, 'fame', fameN));
    }
    if (buffN !== null) {
      rewards.push(targetReward(id, 'buff', buffN));
    }
    if (skillN !== null) {
      rewards.push(targetReward(id, 'skill', skillN));
    }
    await collectItemRewards(source, `${actEndPath}/item`, id, rewards);

    quests.push({
      id,
      name,
      parent,
      description,
      startNpcId: startNpcN,
      endNpcId: endNpcN,
      requiredLevel: lvMinN,
      requiredJob: jobN !== null && jobN > 0 ? jobN : null,
      repeatWait,
      rewardExp: expN ?? 0,
      rewardMeso: mesoN ?? 0,
      rewardFame: fameN ?? 0,
      sourcePath: entry.fullPath,
    });
    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting quests', current: processed, total });
  log.info('extraction complete', {
    quests: quests.length,
    requirements: requirements.length,
    rewards: rewards.length,
    namesFromStringWz,
    namesFromQuestInfo,
    placeholderNames,
    skipped: skipped.length,
  });
  return { quests, requirements, rewards, skipped, placeholderNames };
}

async function collectQuestPrereqs(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRequirementRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, stateNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/state`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(stateNode?.scalar);
    out.push({ questId, kind: 'questPre', targetId, amount });
  }
}

async function collectItemReqs(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRequirementRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, countNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/count`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(countNode?.scalar);
    // Positive counts mean "must hand in N"; non-positive entries are flag
    // checks (own at least one) — store as amount=null in that case.
    out.push({ questId, kind: 'item', targetId, amount: amount && amount > 0 ? amount : null });
  }
}

async function collectMobReqs(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRequirementRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    const [idNode, countNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/count`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(countNode?.scalar);
    out.push({ questId, kind: 'mob', targetId, amount });
  }
}

async function collectItemRewards(
  source: GameDataSource,
  basePath: string,
  questId: number,
  out: QuestRewardRecord[],
): Promise<void> {
  const children = await source.listChildren(basePath);
  for (const c of children) {
    // The WZ child name is a numeric index; preserve it so the UI can
    // group consecutive prop-bearing siblings into one random-reward pool
    // in the same order they appear in the game files.
    const idx = Number(c.name);
    if (!Number.isFinite(idx)) continue;
    const [idNode, countNode, propNode, jobNode, genderNode, periodNode] = await Promise.all([
      source.getNode(`${c.fullPath}/id`),
      source.getNode(`${c.fullPath}/count`),
      source.getNode(`${c.fullPath}/prop`),
      source.getNode(`${c.fullPath}/job`),
      source.getNode(`${c.fullPath}/gender`),
      source.getNode(`${c.fullPath}/period`),
    ]);
    const targetId = scalarToNumber(idNode?.scalar);
    if (targetId === null) continue;
    const amount = scalarToNumber(countNode?.scalar);
    // Negative counts in Act.img mean "consume" — those are really
    // requirements expressed in reward shape; skip here since the Check.img
    // pass already covered consumable requirements.
    if (amount !== null && amount < 0) continue;
    out.push({
      questId,
      kind: 'item',
      idx,
      targetId,
      amount,
      prop: scalarToNumber(propNode?.scalar),
      job: scalarToNumber(jobNode?.scalar),
      gender: scalarToNumber(genderNode?.scalar),
      period: scalarToNumber(periodNode?.scalar),
    });
  }
}

/** Build a scalar reward row (exp, meso, sp, fame). targetId is null. */
function scalarReward(
  questId: number,
  kind: 'exp' | 'meso' | 'sp' | 'fame',
  amount: number,
): QuestRewardRecord {
  return {
    questId,
    kind,
    idx: 0,
    targetId: null,
    amount,
    prop: null,
    job: null,
    gender: null,
    period: null,
  };
}

/** Build a reward row whose payload is a target id (buff itemId, skill id). */
function targetReward(
  questId: number,
  kind: 'buff' | 'skill',
  targetId: number,
): QuestRewardRecord {
  return {
    questId,
    kind,
    idx: 0,
    targetId,
    amount: null,
    prop: null,
    job: null,
    gender: null,
    period: null,
  };
}

async function pickFirstNumber(source: GameDataSource, paths: string[]): Promise<number | null> {
  for (const p of paths) {
    const n = await pathToNumber(source, p);
    if (n !== null) return n;
  }
  return null;
}
