import type { GameDataSource } from '@/parser';
import { pathToNumber, scalarToNumber, scalarToString } from './wzCoerce';
import { unescapeWzString } from './wzText';
import type {
  SkillLevelRecord,
  SkillPrerequisiteRecord,
  SkillRecord,
} from '@/db';
import { createLogger } from '@/lib/logger';
import type { ProgressFn } from '@/lib/progress';
import { pickSprite } from './sprites';

const log = createLogger('extract-skills');

/**
 * Sub-paths under a skill's `<id>` node where a usable icon might live.
 * `icon` is the standard 32×32 representation; `iconRaw` is sometimes
 * the only one present on passive / job-advancement skills.
 */
const SKILL_SPRITE_CANDIDATES = ['icon', 'iconRaw', 'iconMouseOver', 'iconDisabled'];

/**
 * Per-level WZ keys we promote to dedicated columns on `skill_levels`.
 * Anything else encountered in the level node lands in `raw_json` so it
 * can be surfaced later without a migration.
 */
const KNOWN_LEVEL_KEYS = new Set([
  'mpCon',
  'hpCon',
  'damage',
  'attackCount',
  'mobCount',
  'time',
  'cooltime',
  'prop',
  'x',
  'y',
  'z',
  'pad',
  'mad',
  'pdd',
  'mdd',
  'acc',
  'eva',
  'speed',
  'jump',
  'hp',
  'mp',
  'hpR',
  'mpR',
]);

export interface ExtractSkillsResult {
  skills: SkillRecord[];
  levels: SkillLevelRecord[];
  prerequisites: SkillPrerequisiteRecord[];
  skipped: { reason: string; path: string }[];
}

/**
 * Walk `Skill.wz`, joining identity strings from `String.wz/Skill.img`,
 * and emit one `SkillRecord` per skill plus its level and prereq rows.
 *
 * Source layout (v83 GMS / MapleRoyals):
 *
 *   Skill.wz/
 *     <jobId>.img/skill/<skillId>/
 *       common/{maxLevel,masterLevel,invisible}
 *       elemAttr     (e.g. "F" for fire)
 *       weapon       (numeric or string code; we coerce to string)
 *       req/<requiredSkillId> = <requiredLevel>
 *       level/<level>/<field>  (mpCon, damage, time, prop, pad, …)
 *       icon / iconRaw
 *
 *   String.wz/Skill.img/<skillId>/
 *     name, desc, h ?? h1 ?? h2 (tooltip)
 *
 * Non-numeric children of `Skill.wz` (e.g. supplementary `.img` files
 * grouped by job class) are skipped — skill jobs are always integers.
 */
export async function extractSkills(
  source: GameDataSource,
  opts: { onProgress?: ProgressFn } = {},
): Promise<ExtractSkillsResult> {
  const skills: SkillRecord[] = [];
  const levels: SkillLevelRecord[] = [];
  const prerequisites: SkillPrerequisiteRecord[] = [];
  const skipped: { reason: string; path: string }[] = [];

  const root = await source.listChildren('Skill.wz');
  if (root.length === 0) {
    log.debug('Skill.wz absent or empty');
    return { skills, levels, prerequisites, skipped };
  }

  // Each numeric `<jobId>.img` carries one job's skill table. The WZ root
  // also holds a handful of non-job files (e.g. `BookSkill.img`) we skip.
  const jobImgs = root.filter((n) => /^(\d+)\.img$/.test(n.name));

  // Count total skills across all jobs up front so progress percentages
  // are meaningful — the dominant cost is per-skill, not per-job.
  let total = 0;
  const jobSkillEntries: { jobId: number; jobImg: string; skillId: number }[] = [];
  for (const img of jobImgs) {
    const idMatch = img.name.match(/^(\d+)\.img$/);
    if (!idMatch) continue;
    const jobId = Number(idMatch[1]);
    const skillsList = await source.listChildren(`${img.fullPath}/skill`);
    for (const s of skillsList) {
      const sIdMatch = s.name.match(/^(\d+)$/);
      if (!sIdMatch) continue;
      const skillId = Number(sIdMatch[1]);
      jobSkillEntries.push({ jobId, jobImg: img.fullPath, skillId });
      total += 1;
    }
  }
  log.info('discovery complete', { totalSkills: total, totalJobs: jobImgs.length });

  let processed = 0;
  for (const { jobId, jobImg, skillId } of jobSkillEntries) {
    opts.onProgress?.({
      phase: 'Extracting skills',
      current: processed,
      total,
      detail: `Job ${jobId} · skill ${skillId}`,
    });

    const skillPath = `${jobImg}/skill/${skillId}`;
    const stringPath = `String.wz/Skill.img/${skillId}`;

    const [
      nameNode,
      descNode,
      hNode,
      stringChildren,
      maxLevelN,
      masterLevelN,
      invisibleN,
      elemNode,
      weaponNode,
    ] = await Promise.all([
      source.getNode(`${stringPath}/name`),
      source.getNode(`${stringPath}/desc`),
      source.getNode(`${stringPath}/h`),
      source.listChildren(stringPath),
      pathToNumber(source, `${skillPath}/common/maxLevel`),
      pathToNumber(source, `${skillPath}/common/masterLevel`),
      pathToNumber(source, `${skillPath}/common/invisible`),
      source.getNode(`${skillPath}/elemAttr`),
      source.getNode(`${skillPath}/weapon`),
    ]);

    const name = scalarToString(nameNode?.scalar);
    const description = unescapeWzString(scalarToString(descNode?.scalar));
    // `h` is the templated tooltip (e.g. "Boost by #x% for #time sec.")
    // resolved per-level by the renderer. Older dumps skip `h` entirely and
    // put a static description on each level as `h1`, `h2`, ..., `hN`; those
    // are picked up below and attached to each level row.
    const tooltip = unescapeWzString(scalarToString(hNode?.scalar));
    const perLevelDescriptions = new Map<number, string>();
    for (const child of stringChildren) {
      const match = child.name.match(/^h(\d+)$/);
      if (!match) continue;
      const lvl = Number(match[1]);
      if (!Number.isFinite(lvl) || lvl <= 0) continue;
      const text = scalarToString(child.scalar);
      if (!text) continue;
      const unescaped = unescapeWzString(text);
      if (unescaped !== null) perLevelDescriptions.set(lvl, unescaped);
    }
    const element = scalarToString(elemNode?.scalar);
    // `weapon` may arrive as either a number (cleaner v83 dumps) or a
    // string (some private-server repacks). Persist as a string so the
    // domain decoder is the single source of code → label mapping.
    let requiredWeapon: string | null = null;
    if (weaponNode?.scalar !== undefined && weaponNode?.scalar !== null) {
      requiredWeapon =
        typeof weaponNode.scalar === 'number'
          ? String(weaponNode.scalar)
          : weaponNode.scalar;
    }

    // Prerequisites: each child of `req` is a sibling skill id (the child
    // name) whose required level is the child's scalar value.
    const reqChildren = await source.listChildren(`${skillPath}/req`);
    for (const r of reqChildren) {
      const requiredSkillId = Number(r.name);
      const requiredLevel = scalarToNumber(r.scalar);
      if (!Number.isFinite(requiredSkillId) || requiredSkillId <= 0) continue;
      if (requiredLevel === null) continue;
      prerequisites.push({ skillId, requiredSkillId, requiredLevel });
    }

    // Levels: one child per integer level. We don't trust the order they
    // arrive in — the WZ tree may interleave numeric children oddly — so
    // each row carries its own `level` column and gets ordered server-side
    // on read.
    const levelChildren = await source.listChildren(`${skillPath}/level`);
    let highestLevel: number | null = null;
    for (const lvlNode of levelChildren) {
      const level = Number(lvlNode.name);
      if (!Number.isFinite(level) || level <= 0) continue;
      if (highestLevel === null || level > highestLevel) highestLevel = level;
      const fields = await source.listChildren(lvlNode.fullPath);
      const knownNumeric: Record<string, number | null> = {};
      const unknown: Record<string, unknown> = {};
      for (const f of fields) {
        if (KNOWN_LEVEL_KEYS.has(f.name)) {
          knownNumeric[f.name] = scalarToNumber(f.scalar);
        } else {
          // Preserve unknown keys verbatim; the UI ignores them until we
          // promote them to columns, but a future build can read them
          // from `raw_json` without re-extraction.
          unknown[f.name] =
            f.scalar === undefined ? null : f.scalar;
        }
      }
      const rawJson = Object.keys(unknown).length > 0 ? JSON.stringify(unknown) : null;
      levels.push({
        skillId,
        level,
        mpCost: knownNumeric.mpCon ?? null,
        hpCost: knownNumeric.hpCon ?? null,
        damagePercent: knownNumeric.damage ?? null,
        hits: knownNumeric.attackCount ?? null,
        targets: knownNumeric.mobCount ?? null,
        durationSeconds: knownNumeric.time ?? null,
        cooldownSeconds: knownNumeric.cooltime ?? null,
        chancePercent: knownNumeric.prop ?? null,
        x: knownNumeric.x ?? null,
        y: knownNumeric.y ?? null,
        z: knownNumeric.z ?? null,
        pad: knownNumeric.pad ?? null,
        mad: knownNumeric.mad ?? null,
        pdd: knownNumeric.pdd ?? null,
        mdd: knownNumeric.mdd ?? null,
        acc: knownNumeric.acc ?? null,
        eva: knownNumeric.eva ?? null,
        speed: knownNumeric.speed ?? null,
        jump: knownNumeric.jump ?? null,
        hp: knownNumeric.hp ?? null,
        mp: knownNumeric.mp ?? null,
        hpPercent: knownNumeric.hpR ?? null,
        mpPercent: knownNumeric.mpR ?? null,
        description: perLevelDescriptions.get(level) ?? null,
        rawJson,
      });
    }

    const { iconPath, iconData } = await pickSprite(source, skillPath, SKILL_SPRITE_CANDIDATES);

    skills.push({
      id: skillId,
      jobId,
      name,
      description,
      tooltip,
      maxLevel: maxLevelN ?? highestLevel,
      masterLevel: masterLevelN,
      hidden: invisibleN === 1,
      element,
      requiredWeapon,
      iconPath,
      iconData,
      sourcePath: skillPath,
    });

    processed += 1;
  }

  opts.onProgress?.({ phase: 'Extracting skills', current: processed, total });
  log.info('extraction complete', {
    skills: skills.length,
    levels: levels.length,
    prerequisites: prerequisites.length,
    skipped: skipped.length,
  });
  return { skills, levels, prerequisites, skipped };
}
