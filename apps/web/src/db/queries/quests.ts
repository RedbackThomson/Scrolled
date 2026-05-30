import type { Sqlite } from '../sqlite';
import type {
  LevelBandCount,
  ListOptsBase,
  PageResult,
  QuestRecord,
  QuestRequirementRecord,
  QuestRequirementWithName,
  QuestRewardRecord,
  QuestRewardWithName,
  QuestSummary,
} from '../types';
import {
  QUEST_ORDER,
  QUEST_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { QUEST_FILTER, applyFilters } from './shared/filters';
import { rowToQuest, type QuestRow } from './shared/rowMappers';

export function upsertQuests(sql: Sqlite, quests: QuestRecord[]): number {
  sql.transaction(() => {
    for (const q of quests) {
      sql.exec(
        `INSERT INTO quests (
          id, name, parent, description, start_npc_id, end_npc_id,
          required_level, required_job, repeat_wait,
          reward_exp, reward_meso, reward_fame, source_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name           = excluded.name,
          parent         = excluded.parent,
          description    = excluded.description,
          start_npc_id   = excluded.start_npc_id,
          end_npc_id     = excluded.end_npc_id,
          required_level = excluded.required_level,
          required_job   = excluded.required_job,
          repeat_wait    = excluded.repeat_wait,
          reward_exp     = excluded.reward_exp,
          reward_meso    = excluded.reward_meso,
          reward_fame    = excluded.reward_fame,
          source_path    = excluded.source_path`,
        [
          q.id,
          q.name,
          q.parent,
          q.description,
          q.startNpcId,
          q.endNpcId,
          q.requiredLevel,
          q.requiredJob,
          q.repeatWait,
          q.rewardExp,
          q.rewardMeso,
          q.rewardFame,
          q.sourcePath,
        ],
      );
    }
  });
  return quests.length;
}

export function getQuest(sql: Sqlite, id: number): QuestRecord | null {
  const row = sql.selectObject<QuestRow>('SELECT * FROM quests WHERE id = ?', [id]);
  return row ? rowToQuest(row) : null;
}

export function listQuests(
  sql: Sqlite,
  opts: ListOptsBase & { parent?: string } = {},
): PageResult<QuestRecord> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(QUEST_ORDER, QUEST_ORDER_DEFAULT, opts.orderBy, opts.dir);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.search?.trim()) {
    where.push('name LIKE ?');
    params.push(`%${opts.search.trim()}%`);
  }
  if (opts.parent) {
    where.push('parent = ?');
    params.push(opts.parent);
  }
  applyFilters(QUEST_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM quests ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const rows = sql
      .selectObjects<QuestRow>(
        `SELECT * FROM quests ${clause}
         ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      )
      .map(rowToQuest);
    return { rows, total };
  });
}

export function listQuestParents(sql: Sqlite): string[] {
  return sql
    .selectObjects<{
      parent: string;
    }>(
      `SELECT DISTINCT parent FROM quests WHERE parent IS NOT NULL AND parent <> '' ORDER BY parent`,
    )
    .map((r) => r.parent);
}

/**
 * Quest count grouped into required-level bands of `bandSize` (default 10).
 * Quests with `required_level <= 0` or NULL are dropped; the home-page
 * histogram is about the level-gated portion of the quest log.
 */
export function listQuestLevelBandCounts(
  sql: Sqlite,
  bandSize = 10,
): LevelBandCount[] {
  const size = Math.max(1, Math.floor(bandSize));
  const rows = sql.selectObjects<{ band: number; count: number }>(
    `SELECT (required_level / ?) * ? AS band, COUNT(*) AS count
       FROM quests
      WHERE required_level IS NOT NULL AND required_level > 0
      GROUP BY band
      ORDER BY band ASC`,
    [size, size],
  );
  return rows.map((r) => ({ band: Number(r.band), count: Number(r.count) }));
}

export function getQuestRequirements(sql: Sqlite, questId: number): QuestRequirementWithName[] {
  // The display name comes from whichever side of the union the kind points
  // at. We compute it inline with CASE so the result is a single homogenous
  // result set the caller can render directly.
  return sql
    .selectObjects<{
      quest_id: number;
      kind: QuestRequirementRecord['kind'];
      target_id: number | null;
      amount: number | null;
      target_name: string | null;
      target_level: number | null;
    }>(
      `SELECT
         qr.quest_id, qr.kind, qr.target_id, qr.amount,
         CASE qr.kind
           WHEN 'item' THEN COALESCE(i.name, e.name)
           WHEN 'mob'  THEN m.name
           WHEN 'questPre' THEN q.name
           ELSE NULL
         END AS target_name,
         CASE qr.kind
           WHEN 'questPre' THEN q.required_level
           ELSE NULL
         END AS target_level
       FROM quest_requirements qr
       LEFT JOIN items  i ON qr.kind = 'item'     AND i.id = qr.target_id
       LEFT JOIN equips e ON qr.kind = 'item'     AND e.id = qr.target_id
       LEFT JOIN mobs   m ON qr.kind = 'mob'      AND m.id = qr.target_id
       LEFT JOIN quests q ON qr.kind = 'questPre' AND q.id = qr.target_id
       WHERE qr.quest_id = ?
       ORDER BY qr.kind, qr.target_id`,
      [questId],
    )
    .map((r) => ({
      questId: r.quest_id,
      kind: r.kind,
      targetId: r.target_id,
      amount: r.amount,
      targetName: r.target_name,
      targetLevel: r.target_level,
    }));
}

export function getQuestRewards(sql: Sqlite, questId: number): QuestRewardWithName[] {
  return sql
    .selectObjects<{
      quest_id: number;
      kind: QuestRewardRecord['kind'];
      idx: number;
      target_id: number | null;
      amount: number | null;
      prop: number | null;
      job: number | null;
      gender: number | null;
      period: number | null;
      target_name: string | null;
    }>(
      `SELECT
         qr.quest_id, qr.kind, qr.idx, qr.target_id, qr.amount,
         qr.prop, qr.job, qr.gender, qr.period,
         CASE qr.kind
           WHEN 'item' THEN COALESCE(i.name, e.name)
           ELSE NULL
         END AS target_name
       FROM quest_rewards qr
       LEFT JOIN items  i ON qr.kind = 'item' AND i.id = qr.target_id
       LEFT JOIN equips e ON qr.kind = 'item' AND e.id = qr.target_id
       WHERE qr.quest_id = ?
       ORDER BY qr.kind, qr.idx, qr.target_id`,
      [questId],
    )
    .map((r) => ({
      questId: r.quest_id,
      kind: r.kind,
      idx: r.idx,
      targetId: r.target_id,
      amount: r.amount,
      prop: r.prop,
      job: r.job,
      gender: r.gender,
      period: r.period,
      targetName: r.target_name,
    }));
}

export function getNpcQuests(sql: Sqlite, npcId: number): QuestSummary[] {
  return sql
    .selectObjects<{
      id: number;
      name: string;
      parent: string | null;
      required_level: number | null;
    }>(
      `SELECT id, name, parent, required_level FROM quests
       WHERE start_npc_id = ? OR end_npc_id = ?
       ORDER BY parent NULLS LAST, name`,
      [npcId, npcId],
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      parent: r.parent,
      requiredLevel: r.required_level,
    }));
}

export function getItemQuests(sql: Sqlite, itemId: number): QuestSummary[] {
  return sql
    .selectObjects<{
      id: number;
      name: string;
      parent: string | null;
      required_level: number | null;
    }>(
      `SELECT DISTINCT q.id, q.name, q.parent, q.required_level
       FROM quests q
       JOIN quest_requirements qr ON qr.quest_id = q.id
       WHERE qr.kind = 'item' AND qr.target_id = ?
       ORDER BY q.parent NULLS LAST, q.name`,
      [itemId],
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      parent: r.parent,
      requiredLevel: r.required_level,
    }));
}

export function getMobQuests(sql: Sqlite, mobId: number): QuestSummary[] {
  return sql
    .selectObjects<{
      id: number;
      name: string;
      parent: string | null;
      required_level: number | null;
    }>(
      `SELECT DISTINCT q.id, q.name, q.parent, q.required_level
       FROM quests q
       JOIN quest_requirements qr ON qr.quest_id = q.id
       WHERE qr.kind = 'mob' AND qr.target_id = ?
       ORDER BY q.parent NULLS LAST, q.name`,
      [mobId],
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      parent: r.parent,
      requiredLevel: r.required_level,
    }));
}

export function replaceQuestRelations(
  sql: Sqlite,
  rows: {
    requirements: QuestRequirementRecord[];
    rewards: QuestRewardRecord[];
  },
): void {
  // Wipe rows for every quest mentioned in either list so re-extracts
  // don't leave stale joins. Same pattern as replaceMapLife.
  const questIds = new Set<number>();
  for (const r of rows.requirements) questIds.add(r.questId);
  for (const r of rows.rewards) questIds.add(r.questId);
  sql.transaction(() => {
    for (const id of questIds) {
      sql.exec('DELETE FROM quest_requirements WHERE quest_id = ?', [id]);
      sql.exec('DELETE FROM quest_rewards      WHERE quest_id = ?', [id]);
    }
    for (const r of rows.requirements) {
      sql.exec(
        `INSERT OR REPLACE INTO quest_requirements (quest_id, kind, target_id, amount)
         VALUES (?, ?, ?, ?)`,
        [r.questId, r.kind, r.targetId, r.amount],
      );
    }
    for (const r of rows.rewards) {
      sql.exec(
        `INSERT OR REPLACE INTO quest_rewards
           (quest_id, kind, idx, target_id, amount, prop, job, gender, period)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.questId,
          r.kind,
          r.idx,
          r.targetId,
          r.amount,
          r.prop,
          r.job,
          r.gender,
          r.period,
        ],
      );
    }
  });
}
