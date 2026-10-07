export interface PathEdge {
  fromQuestId: number;
  toQuestId: number;
}

export interface ChainPath {
  questIds: Set<number>;
  /** `${from}-${to}` keys of the edges on the path. */
  edgeKeys: Set<string>;
}

export const edgeKey = (from: number, to: number) => `${from}-${to}`;

/**
 * Shortest path from any start quest to `target`, by edge count. A target no
 * start reaches (a ghost ancestor from another chain, say) is a path of one.
 */
export function shortestPathTo(
  target: number,
  starts: readonly number[],
  edges: readonly PathEdge[],
): ChainPath {
  const out = new Map<number, number[]>();
  for (const e of edges) {
    if (e.fromQuestId === e.toQuestId) continue;
    const list = out.get(e.fromQuestId) ?? [];
    list.push(e.toQuestId);
    out.set(e.fromQuestId, list);
  }

  const prev = new Map<number, number | null>();
  const queue: number[] = [];
  for (const s of starts) {
    if (!prev.has(s)) {
      prev.set(s, null);
      queue.push(s);
    }
  }
  for (let i = 0; i < queue.length && !prev.has(target); i++) {
    for (const next of out.get(queue[i]) ?? []) {
      if (prev.has(next)) continue;
      prev.set(next, queue[i]);
      queue.push(next);
    }
  }

  const questIds = new Set<number>([target]);
  const edgeKeys = new Set<string>();
  if (!prev.has(target)) return { questIds, edgeKeys };
  let node = target;
  for (let p = prev.get(node); p != null; p = prev.get(node)) {
    edgeKeys.add(edgeKey(p, node));
    questIds.add(p);
    node = p;
  }
  return { questIds, edgeKeys };
}
