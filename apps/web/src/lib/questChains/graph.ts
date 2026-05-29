// Pure (no React, no SQLite) derivation of quest "chains" from a directed
// graph of quest prerequisites. A chain is one weakly-connected component
// of the graph — the set of quests transitively related by prerequisite
// edges walked in either direction. Chains of size 1 (isolated quests) are
// discarded; the smallest persisted chain has two quests.
//
// The directed graph is not assumed acyclic. Tarjan's SCC algorithm finds
// any cycles, the condensation gives a DAG over super-nodes, and chain
// members in a cyclic SCC are flagged so the UI can render them as a
// grouped block with a cycle indicator. Edge direction is "prereq →
// dependent".

export interface PrereqEdge {
  /** Prerequisite quest id. */
  from: number;
  /** Dependent quest id. */
  to: number;
}

export interface QuestChainGraphInput {
  /** Every known quest id, including isolated ones — so size-1 components
   *  can be recognised and dropped. */
  questIds: readonly number[];
  /** All prereq edges. Duplicates and self-loops are tolerated. */
  edges: readonly PrereqEdge[];
  /** Display name per quest. Missing entries fall back to "Quest <id>". */
  questNames: ReadonlyMap<number, string>;
  /** `parent` (area / storyline) per quest, when known. */
  questParents: ReadonlyMap<number, string | null>;
}

export interface ComputedQuestChainMember {
  questId: number;
  /** Min condensation-BFS distance from a condensation root SCC. */
  depth: number;
  /** Local-to-this-chain id for a multi-quest or self-looping SCC. `null`
   *  for acyclic singletons — the schema persists it as NULL. */
  sccId: number | null;
  /** True iff this quest has no incoming prereq edges (strict). Multi-root
   *  chains have `> 1` of these; fully-cyclic chains have none. */
  isRoot: boolean;
  /** True iff this quest sits on a path from any starting quest to the
   *  chain's "final" quest (the deepest leaf, tiebroken by lowest id).
   *  False marks the quest as optional — still part of the chain, but
   *  skippable when racing toward the final. Always true in fully-cyclic
   *  chains (the loop is both root and final). */
  isCritical: boolean;
}

export interface ComputedQuestChainEdge {
  fromQuestId: number;
  toQuestId: number;
  /** True iff both endpoints share a cyclic SCC (or it's a self-loop). */
  inCycle: boolean;
}

export interface ComputedQuestChain {
  id: number;
  name: string;
  representativeRootId: number;
  rootCount: number;
  size: number;
  maxDepth: number;
  hasCycles: boolean;
  cycleCount: number;
  parent: string | null;
  members: ComputedQuestChainMember[];
  edges: ComputedQuestChainEdge[];
}

export function computeQuestChains(input: QuestChainGraphInput): ComputedQuestChain[] {
  const { questIds, edges, questNames, questParents } = input;
  if (questIds.length === 0) return [];

  // Directed adjacency + per-node incoming count for root detection.
  // `out` keys also serve as the "known quest" set.
  const out = new Map<number, number[]>();
  const incomingCount = new Map<number, number>();
  for (const id of questIds) {
    out.set(id, []);
    incomingCount.set(id, 0);
  }

  // De-duplicate edges (the source graph may have parallel entries) and
  // drop any pointing at unknown quests. Self-loops are kept and tracked
  // separately so singleton SCCs touched by one get flagged cyclic.
  const seen = new Set<string>();
  const dedupedEdges: PrereqEdge[] = [];
  const selfLoops = new Set<number>();
  for (const e of edges) {
    if (!out.has(e.from) || !out.has(e.to)) continue;
    const key = `${e.from}>${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedEdges.push(e);
    out.get(e.from)!.push(e.to);
    incomingCount.set(e.to, (incomingCount.get(e.to) ?? 0) + 1);
    if (e.from === e.to) selfLoops.add(e.from);
  }

  // Union-find over the undirected projection — yields WCCs.
  const ufParent = new Map<number, number>();
  for (const id of questIds) ufParent.set(id, id);
  const find = (x: number): number => {
    let cur = x;
    while (ufParent.get(cur)! !== cur) {
      const p = ufParent.get(cur)!;
      ufParent.set(cur, ufParent.get(p)!);
      cur = ufParent.get(cur)!;
    }
    return cur;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) ufParent.set(ra, rb);
  };
  for (const e of dedupedEdges) union(e.from, e.to);

  const wccs = new Map<number, number[]>();
  for (const id of questIds) {
    const r = find(id);
    const arr = wccs.get(r);
    if (arr) arr.push(id);
    else wccs.set(r, [id]);
  }

  // Tarjan SCC over the whole directed graph. `sccIndexOf[q]` then gives
  // each quest its SCC index, shared across the run.
  const sccs = tarjanScc(questIds, out);
  const sccIndexOf = new Map<number, number>();
  for (let i = 0; i < sccs.length; i++) {
    for (const q of sccs[i]) sccIndexOf.set(q, i);
  }

  const results: ComputedQuestChain[] = [];

  for (const memberIds of wccs.values()) {
    if (memberIds.length < 2) continue;
    const memberSet = new Set(memberIds);

    // SCCs touching this WCC, re-indexed to a local 1..N for the schema's
    // `scc_id`. Acyclic singleton SCCs get `null` (sentinel 0 here).
    const sccsInWcc = new Set<number>();
    for (const q of memberIds) sccsInWcc.add(sccIndexOf.get(q)!);
    const localSccId = new Map<number, number>();
    let cycleCount = 0;
    for (const gi of sccsInWcc) {
      const scc = sccs[gi];
      const cyclic = scc.length > 1 || selfLoops.has(scc[0]);
      if (cyclic) {
        cycleCount++;
        localSccId.set(gi, cycleCount);
      } else {
        localSccId.set(gi, 0);
      }
    }

    // Condensation restricted to this WCC, for the depth BFS.
    const condOut = new Map<number, Set<number>>();
    const condIncoming = new Map<number, number>();
    for (const s of sccsInWcc) {
      condOut.set(s, new Set());
      condIncoming.set(s, 0);
    }
    for (const e of dedupedEdges) {
      if (!memberSet.has(e.from)) continue;
      const a = sccIndexOf.get(e.from)!;
      const b = sccIndexOf.get(e.to)!;
      if (a === b) continue;
      const bucket = condOut.get(a)!;
      if (!bucket.has(b)) {
        bucket.add(b);
        condIncoming.set(b, (condIncoming.get(b) ?? 0) + 1);
      }
    }

    // Multi-source BFS from every condensation root SCC. The condensation
    // is always a DAG, so root SCCs always exist (including the trivial
    // case where the whole WCC is one SCC).
    const sccDepth = new Map<number, number>();
    const queue: number[] = [];
    for (const s of sccsInWcc) {
      if ((condIncoming.get(s) ?? 0) === 0) {
        sccDepth.set(s, 0);
        queue.push(s);
      }
    }
    while (queue.length) {
      const cur = queue.shift()!;
      const d = sccDepth.get(cur)!;
      for (const next of condOut.get(cur)!) {
        if (!sccDepth.has(next)) {
          sccDepth.set(next, d + 1);
          queue.push(next);
        }
      }
    }
    for (const s of sccsInWcc) if (!sccDepth.has(s)) sccDepth.set(s, 0);

    let maxDepth = 0;
    for (const d of sccDepth.values()) if (d > maxDepth) maxDepth = d;

    // "Root" in the user-facing sense: a quest you can start with — no
    // incoming prereq edges at all (not even a self-loop). Distinct from
    // the condensation's root SCCs used for layout.
    const roots: number[] = [];
    for (const q of memberIds) {
      if ((incomingCount.get(q) ?? 0) === 0) roots.push(q);
    }
    const rootSet = new Set(roots);

    // Critical path = the set of quests on any path from a starting quest
    // to the chain's "final" SCC (the deepest one — the natural endpoint
    // a player is trying to reach). Optional quests are members that
    // don't sit on such a path; they're still part of the chain but can
    // be skipped without blocking progress toward the final quest.
    //
    // We pick the final SCC as the condensation node with max depth.
    // Tiebreak: the SCC containing the lowest min quest id — same
    // determinism rule as chain id selection, so the choice is stable
    // across re-derivations. Ancestors of the final SCC are marked
    // critical via a reverse BFS over the condensation. For fully-cyclic
    // chains the whole loop is its own ancestor set, so every member is
    // critical (nothing to skip).
    const condIn = new Map<number, Set<number>>();
    for (const s of sccsInWcc) condIn.set(s, new Set());
    for (const [from, tos] of condOut) {
      for (const to of tos) condIn.get(to)!.add(from);
    }
    let finalScc = -1;
    let finalSccDepth = -1;
    let finalSccTiebreak = Infinity;
    for (const s of sccsInWcc) {
      const d = sccDepth.get(s) ?? 0;
      const minQ = Math.min(...sccs[s]);
      if (d > finalSccDepth || (d === finalSccDepth && minQ < finalSccTiebreak)) {
        finalScc = s;
        finalSccDepth = d;
        finalSccTiebreak = minQ;
      }
    }
    const criticalSccs = new Set<number>();
    if (finalScc !== -1) {
      criticalSccs.add(finalScc);
      const critQueue = [finalScc];
      while (critQueue.length) {
        const cur = critQueue.shift()!;
        for (const pred of condIn.get(cur) ?? []) {
          if (!criticalSccs.has(pred)) {
            criticalSccs.add(pred);
            critQueue.push(pred);
          }
        }
      }
    }

    const chainId = roots.length > 0
      ? Math.min(...roots)
      : Math.min(...memberIds);
    const fallbackName = (id: number): string => questNames.get(id) ?? `Quest ${id}`;
    const name = roots.length > 0
      ? fallbackName(chainId)
      : `Loop containing ${fallbackName(chainId)}`;
    const parent = questParents.get(chainId) ?? null;

    const members: ComputedQuestChainMember[] = memberIds.map((q) => {
      const gi = sccIndexOf.get(q)!;
      const localId = localSccId.get(gi)!;
      return {
        questId: q,
        depth: sccDepth.get(gi)!,
        sccId: localId === 0 ? null : localId,
        isRoot: rootSet.has(q),
        isCritical: criticalSccs.has(gi),
      };
    });

    const chainEdges: ComputedQuestChainEdge[] = [];
    for (const e of dedupedEdges) {
      if (!memberSet.has(e.from)) continue;
      const a = sccIndexOf.get(e.from)!;
      const inCycle = a === sccIndexOf.get(e.to) && (sccs[a].length > 1 || e.from === e.to);
      chainEdges.push({ fromQuestId: e.from, toQuestId: e.to, inCycle });
    }

    results.push({
      id: chainId,
      name,
      representativeRootId: chainId,
      rootCount: roots.length,
      size: memberIds.length,
      maxDepth,
      hasCycles: cycleCount > 0,
      cycleCount,
      parent,
      members,
      edges: chainEdges,
    });
  }

  // Stable order — keeps test assertions clean and the index render
  // deterministic before any SQL `ORDER BY` is applied.
  results.sort((a, b) => a.id - b.id);
  return results;
}

// Iterative Tarjan SCC. Recursive is shorter but quest graphs can be deep
// enough (long prereq chains) that a blown stack is a real risk.
function tarjanScc(nodes: readonly number[], adj: Map<number, number[]>): number[][] {
  let nextIndex = 0;
  const indices = new Map<number, number>();
  const lowlinks = new Map<number, number>();
  const onStack = new Set<number>();
  const stack: number[] = [];
  const result: number[][] = [];

  // One DFS frame: {node, iter} — `iter` is the next neighbour to visit.
  // We push when we descend and update the parent's lowlink when we pop.
  for (const start of nodes) {
    if (indices.has(start)) continue;
    indices.set(start, nextIndex);
    lowlinks.set(start, nextIndex);
    nextIndex++;
    stack.push(start);
    onStack.add(start);
    const work: { node: number; iter: number }[] = [{ node: start, iter: 0 }];

    while (work.length) {
      const top = work[work.length - 1];
      const neighbors = adj.get(top.node) ?? [];
      if (top.iter < neighbors.length) {
        const w = neighbors[top.iter++];
        if (!indices.has(w)) {
          indices.set(w, nextIndex);
          lowlinks.set(w, nextIndex);
          nextIndex++;
          stack.push(w);
          onStack.add(w);
          work.push({ node: w, iter: 0 });
        } else if (onStack.has(w)) {
          const cur = lowlinks.get(top.node)!;
          const cand = indices.get(w)!;
          if (cand < cur) lowlinks.set(top.node, cand);
        }
      } else {
        if (lowlinks.get(top.node) === indices.get(top.node)) {
          const scc: number[] = [];
          while (true) {
            const v = stack.pop()!;
            onStack.delete(v);
            scc.push(v);
            if (v === top.node) break;
          }
          result.push(scc);
        }
        const finished = work.pop()!;
        if (work.length) {
          const parent = work[work.length - 1];
          const parentLow = lowlinks.get(parent.node)!;
          const finLow = lowlinks.get(finished.node)!;
          if (finLow < parentLow) lowlinks.set(parent.node, finLow);
        }
      }
    }
  }

  return result;
}
