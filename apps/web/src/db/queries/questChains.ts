import type { Row, Sqlite } from '../sqlite';
import type {
  ListOptsBase,
  PageResult,
  QuestChainDetail,
  QuestChainEdgeRecord,
  QuestChainListRow,
  QuestChainMemberWithName,
  QuestChainRecord,
  QuestSummary,
} from '../types';
import { computeQuestChains, type PrereqEdge } from '@/lib/questChains/graph';
import {
  QUEST_CHAIN_ORDER,
  QUEST_CHAIN_ORDER_DEFAULT,
  clampLimit,
  clampOffset,
  resolveOrder,
} from './shared/order';
import { QUEST_CHAIN_FILTER, applyFilters } from './shared/filters';

interface QuestChainRow extends Row {
  id: number;
  name: string;
  representative_root_id: number;
  root_count: number;
  size: number;
  max_depth: number;
  has_cycles: number;
  cycle_count: number;
  parent: string | null;
}

function rowToChain(r: QuestChainRow): QuestChainRecord {
  return {
    id: r.id,
    name: r.name,
    representativeRootId: r.representative_root_id,
    rootCount: r.root_count,
    size: r.size,
    maxDepth: r.max_depth,
    hasCycles: r.has_cycles === 1,
    cycleCount: r.cycle_count,
    parent: r.parent,
  };
}

/**
 * Derive quest chains from `quest_requirements` (kind='questPre') rows and
 * overwrite the three chain tables. Idempotent — safe to re-run after every
 * extraction. The compute itself is pure (see lib/questChains/graph.ts);
 * this function just glues SQL reads/writes around it.
 *
 * Returns the count of chains persisted (for the extraction tracker).
 */
export function computeAndStoreQuestChains(sql: Sqlite): number {
  const quests = sql.selectObjects<{ id: number; name: string; parent: string | null }>(
    `SELECT id, name, parent FROM quests`,
  );
  const prereqRows = sql.selectObjects<{ quest_id: number; target_id: number | null }>(
    `SELECT quest_id, target_id
       FROM quest_requirements
      WHERE kind = 'questPre' AND target_id IS NOT NULL`,
  );

  const questIds = quests.map((q) => q.id);
  const edges: PrereqEdge[] = prereqRows
    .filter((r) => r.target_id !== null)
    .map((r) => ({ from: r.target_id as number, to: r.quest_id }));
  const questNames = new Map<number, string>(quests.map((q) => [q.id, q.name]));
  const questParents = new Map<number, string | null>(quests.map((q) => [q.id, q.parent]));

  const chains = computeQuestChains({ questIds, edges, questNames, questParents });

  sql.transaction(() => {
    sql.exec(`DELETE FROM quest_chain_edges`);
    sql.exec(`DELETE FROM quest_chain_members`);
    sql.exec(`DELETE FROM quest_chains`);
    for (const c of chains) {
      sql.exec(
        `INSERT INTO quest_chains
          (id, name, representative_root_id, root_count, size, max_depth,
           has_cycles, cycle_count, parent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          c.name,
          c.representativeRootId,
          c.rootCount,
          c.size,
          c.maxDepth,
          c.hasCycles ? 1 : 0,
          c.cycleCount,
          c.parent,
        ],
      );
      for (const m of c.members) {
        sql.exec(
          `INSERT INTO quest_chain_members
            (chain_id, quest_id, depth, scc_id, is_root, is_critical)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [c.id, m.questId, m.depth, m.sccId, m.isRoot ? 1 : 0, m.isCritical ? 1 : 0],
        );
      }
      for (const e of c.edges) {
        sql.exec(
          `INSERT INTO quest_chain_edges
            (chain_id, from_quest_id, to_quest_id, in_cycle)
           VALUES (?, ?, ?, ?)`,
          [c.id, e.fromQuestId, e.toQuestId, e.inCycle ? 1 : 0],
        );
      }
    }
  });

  return chains.length;
}

export function getQuestChain(sql: Sqlite, id: number): QuestChainDetail | null {
  const row = sql.selectObject<QuestChainRow>(
    `SELECT * FROM quest_chains WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  const chain = rowToChain(row);
  const members = sql
    .selectObjects<{
      chain_id: number;
      quest_id: number;
      depth: number;
      scc_id: number | null;
      is_root: number;
      is_critical: number;
      quest_name: string;
      quest_parent: string | null;
      quest_required_level: number | null;
    }>(
      `SELECT m.chain_id, m.quest_id, m.depth, m.scc_id, m.is_root, m.is_critical,
              q.name           AS quest_name,
              q.parent         AS quest_parent,
              q.required_level AS quest_required_level
         FROM quest_chain_members m
         JOIN quests q ON q.id = m.quest_id
        WHERE m.chain_id = ?
        ORDER BY m.depth ASC, m.is_critical DESC, m.is_root DESC, q.name ASC, m.quest_id ASC`,
      [id],
    )
    .map<QuestChainMemberWithName>((r) => ({
      chainId: r.chain_id,
      questId: r.quest_id,
      depth: r.depth,
      sccId: r.scc_id,
      isRoot: r.is_root === 1,
      isCritical: r.is_critical === 1,
      questName: r.quest_name,
      questParent: r.quest_parent,
      questRequiredLevel: r.quest_required_level,
    }));
  const edges = sql
    .selectObjects<{
      chain_id: number;
      from_quest_id: number;
      to_quest_id: number;
      in_cycle: number;
    }>(
      `SELECT chain_id, from_quest_id, to_quest_id, in_cycle
         FROM quest_chain_edges
        WHERE chain_id = ?`,
      [id],
    )
    .map<QuestChainEdgeRecord>((r) => ({
      chainId: r.chain_id,
      fromQuestId: r.from_quest_id,
      toQuestId: r.to_quest_id,
      inCycle: r.in_cycle === 1,
    }));
  return { chain, members, edges };
}

export function listQuestChains(
  sql: Sqlite,
  opts: ListOptsBase & { parent?: string } = {},
): PageResult<QuestChainListRow> {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const order = resolveOrder(
    QUEST_CHAIN_ORDER,
    QUEST_CHAIN_ORDER_DEFAULT,
    opts.orderBy,
    opts.dir,
  );
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
  applyFilters(QUEST_CHAIN_FILTER, opts.filters, where, params);
  const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  return sql.transaction(() => {
    const total = Number(
      sql.selectValue(
        `SELECT COUNT(*) FROM quest_chains ${clause}`,
        params.length > 0 ? params : undefined,
      ) ?? 0,
    );
    const chainRows = sql.selectObjects<QuestChainRow>(
      `SELECT * FROM quest_chains ${clause}
       ORDER BY ${order.col} ${order.dir === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, id ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    if (chainRows.length === 0) return { rows: [], total };

    // Per-chain preview: up to 3 members nearest the root for the "starts
    // with …" hint column on the index. One follow-up query keyed by the
    // ids in play, then bucket client-side — avoids N round-trips while
    // keeping the listing query itself unchanged.
    const ids = chainRows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const previewRows = sql.selectObjects<{
      chain_id: number;
      quest_id: number;
      name: string;
      parent: string | null;
    }>(
      `SELECT m.chain_id, m.quest_id, q.name, q.parent
         FROM quest_chain_members m
         JOIN quests q ON q.id = m.quest_id
        WHERE m.chain_id IN (${placeholders})
        ORDER BY m.chain_id, m.depth ASC, m.is_root DESC, q.name ASC, m.quest_id ASC`,
      ids,
    );
    const previewBy = new Map<number, QuestSummary[]>();
    for (const r of previewRows) {
      const arr = previewBy.get(r.chain_id);
      if (arr) {
        if (arr.length < 3) arr.push({ id: r.quest_id, name: r.name, parent: r.parent });
      } else {
        previewBy.set(r.chain_id, [{ id: r.quest_id, name: r.name, parent: r.parent }]);
      }
    }
    const rows: QuestChainListRow[] = chainRows.map((r) => ({
      ...rowToChain(r),
      preview: previewBy.get(r.id) ?? [],
    }));
    return { rows, total };
  });
}

export function listQuestChainParents(sql: Sqlite): string[] {
  return sql
    .selectObjects<{ parent: string }>(
      `SELECT DISTINCT parent FROM quest_chains
        WHERE parent IS NOT NULL AND parent <> ''
        ORDER BY parent`,
    )
    .map((r) => r.parent);
}

/**
 * The chain a given quest belongs to (or null if the quest is isolated or
 * its WCC was size 1). Used by QuestDetail to surface the "Part of chain"
 * link.
 */
export function getChainForQuest(sql: Sqlite, questId: number): QuestChainRecord | null {
  const row = sql.selectObject<QuestChainRow>(
    `SELECT c.*
       FROM quest_chain_members m
       JOIN quest_chains c ON c.id = m.chain_id
      WHERE m.quest_id = ?
      LIMIT 1`,
    [questId],
  );
  return row ? rowToChain(row) : null;
}
