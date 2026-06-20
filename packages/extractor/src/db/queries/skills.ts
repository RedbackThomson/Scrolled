import type { Sqlite } from '../sqlite';
import type {
  ListOptsBase,
  PageResult,
  QuestSummary,
  SkillLevelRecord,
  SkillPrerequisiteRecord,
  SkillPrerequisiteWithName,
  SkillRecord,
} from '../types';
import {
  SKILL_ORDER,
  SKILL_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { SKILL_FILTER, applyFilters } from './shared/filters';
import {
  rowToSkill,
  rowToSkillLevel,
  type SkillLevelRow,
  type SkillRow,
} from './shared/rowMappers';

export function upsertSkills(sql: Sqlite, skills: SkillRecord[]): number {
  sql.transaction(() => {
    for (const s of skills) {
      sql.exec(
        `INSERT INTO skills (
          id, job_id, name, description, tooltip, max_level, master_level,
          hidden, element, required_weapon, icon_path, icon_data, source_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          job_id          = excluded.job_id,
          name            = excluded.name,
          description     = excluded.description,
          tooltip         = excluded.tooltip,
          max_level       = excluded.max_level,
          master_level    = excluded.master_level,
          hidden          = excluded.hidden,
          element         = excluded.element,
          required_weapon = excluded.required_weapon,
          icon_path       = excluded.icon_path,
          -- Preserve a previously-decoded icon when this run produced
          -- none (mirrors mobs' upsert).
          icon_data       = COALESCE(excluded.icon_data, skills.icon_data),
          source_path     = excluded.source_path`,
        [
          s.id,
          s.jobId,
          s.name,
          s.description,
          s.tooltip,
          s.maxLevel,
          s.masterLevel,
          s.hidden ? 1 : 0,
          s.element,
          s.requiredWeapon,
          s.iconPath,
          s.iconData,
          s.sourcePath,
        ],
      );
    }
  });
  return skills.length;
}

export function getSkillIcon(sql: Sqlite, id: number): Uint8Array | null {
  const row = sql.selectObject<{ icon_data: Uint8Array | null }>(
    'SELECT icon_data FROM skills WHERE id = ?',
    [id],
  );
  return row?.icon_data ?? null;
}

export function getSkill(sql: Sqlite, id: number): SkillRecord | null {
  const row = sql.selectObject<SkillRow>('SELECT * FROM skills WHERE id = ?', [id]);
  return row ? rowToSkill(row) : null;
}

export function listSkills(sql: Sqlite, opts: ListOptsBase = {}): PageResult<SkillRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(SKILL_ORDER, SKILL_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${opts.search.trim()}%`);
  }
  applyFilters(SKILL_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM skills ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<SkillRow>(
        `SELECT id, job_id, name, description, tooltip, max_level, master_level,
                hidden, element, required_weapon, icon_path, NULL AS icon_data, source_path
         FROM skills ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToSkill);
    return { rows, total };
  });
}

export function getSkillLevels(sql: Sqlite, skillId: number): SkillLevelRecord[] {
  return sql
    .selectObjects<SkillLevelRow>(
      `SELECT * FROM skill_levels WHERE skill_id = ? ORDER BY level ASC`,
      [skillId],
    )
    .map(rowToSkillLevel);
}

export function getSkillPrerequisites(
  sql: Sqlite,
  skillId: number,
): SkillPrerequisiteWithName[] {
  return sql
    .selectObjects<{
      skill_id: number;
      required_skill_id: number;
      required_level: number;
      required_skill_name: string | null;
    }>(
      `SELECT p.skill_id, p.required_skill_id, p.required_level, s.name AS required_skill_name
       FROM skill_prerequisites p
       LEFT JOIN skills s ON s.id = p.required_skill_id
       WHERE p.skill_id = ?
       ORDER BY p.required_skill_id`,
      [skillId],
    )
    .map((r) => ({
      skillId: r.skill_id,
      requiredSkillId: r.required_skill_id,
      requiredLevel: r.required_level,
      requiredSkillName: r.required_skill_name,
    }));
}

export function getSkillsRequiring(
  sql: Sqlite,
  requiredSkillId: number,
): SkillPrerequisiteWithName[] {
  // Same shape as the forward lookup, just inverted. The "required" name we
  // surface is the parent skill (the one that needs this one) — keeping the
  // field name lets the UI render both sides with the same component.
  return sql
    .selectObjects<{
      skill_id: number;
      required_skill_id: number;
      required_level: number;
      parent_name: string | null;
    }>(
      `SELECT p.skill_id, p.required_skill_id, p.required_level, s.name AS parent_name
       FROM skill_prerequisites p
       LEFT JOIN skills s ON s.id = p.skill_id
       WHERE p.required_skill_id = ?
       ORDER BY p.skill_id`,
      [requiredSkillId],
    )
    .map((r) => ({
      skillId: r.skill_id,
      requiredSkillId: r.required_skill_id,
      requiredLevel: r.required_level,
      requiredSkillName: r.parent_name,
    }));
}

export function getSkillQuests(sql: Sqlite, skillId: number): QuestSummary[] {
  return sql
    .selectObjects<{
      id: number;
      name: string;
      parent: string | null;
      required_level: number | null;
    }>(
      `SELECT q.id, q.name, q.parent, q.required_level
       FROM quest_rewards r
       JOIN quests q ON q.id = r.quest_id
       WHERE r.kind = 'skill' AND r.target_id = ?
       ORDER BY q.name`,
      [skillId],
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      parent: r.parent,
      requiredLevel: r.required_level,
    }));
}

export function replaceSkillRelations(
  sql: Sqlite,
  rows: { levels: SkillLevelRecord[]; prerequisites: SkillPrerequisiteRecord[] },
): void {
  // Collect distinct skill IDs touched by either side so we delete prior
  // rows for each before reinserting (mirrors replaceMobDrops / replaceQuestRelations).
  const skillIds = new Set<number>();
  for (const l of rows.levels) skillIds.add(l.skillId);
  for (const p of rows.prerequisites) skillIds.add(p.skillId);
  sql.transaction(() => {
    for (const id of skillIds) {
      sql.exec('DELETE FROM skill_levels WHERE skill_id = ?', [id]);
      sql.exec('DELETE FROM skill_prerequisites WHERE skill_id = ?', [id]);
    }
    for (const l of rows.levels) {
      sql.exec(
        `INSERT INTO skill_levels (
          skill_id, level, mp_cost, hp_cost, damage_percent, hits, targets,
          duration_seconds, cooldown_seconds, chance_percent, x, y, z,
          pad, mad, pdd, mdd, acc, eva, speed, jump, hp, mp,
          hp_percent, mp_percent, description, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          l.skillId,
          l.level,
          l.mpCost,
          l.hpCost,
          l.damagePercent,
          l.hits,
          l.targets,
          l.durationSeconds,
          l.cooldownSeconds,
          l.chancePercent,
          l.x,
          l.y,
          l.z,
          l.pad,
          l.mad,
          l.pdd,
          l.mdd,
          l.acc,
          l.eva,
          l.speed,
          l.jump,
          l.hp,
          l.mp,
          l.hpPercent,
          l.mpPercent,
          l.description,
          l.rawJson,
        ],
      );
    }
    for (const p of rows.prerequisites) {
      sql.exec(
        `INSERT INTO skill_prerequisites (skill_id, required_skill_id, required_level)
         VALUES (?, ?, ?)`,
        [p.skillId, p.requiredSkillId, p.requiredLevel],
      );
    }
  });
}
