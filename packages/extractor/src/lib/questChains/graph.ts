// Pure (no React, no SQLite) derivation of quest "chains" from a directed
// graph of quest prerequisites.
//
// A chain is a *parent-bounded* weakly-connected component, with two
// overrides for cycles:
//   1. Quests sharing a multi-quest SCC (a directed cycle in the
//      quest-level graph, however indirect) are always in the same chain
//      regardless of `parent`.
//   2. After parent-bounded grouping, any chain-level cycle (chain A has
//      an out-edge to chain B AND chain B has an out-edge back to A,
//      possibly indirectly) is collapsed: the entire chain-level SCC
//      merges into one chain.
// Both overrides exist for the same reason — cycles can't be sequenced
// one-at-a-time, so leaving them split would produce two chains that
// mutually gate each other, which is unsequenceable and confusing.
//
// Concretely: two quests sit in the same chain when ANY of
//   (a) they're members of the same multi-quest SCC (quest-level cycles merge), OR
//   (b) they share a `parent` value and an undirected path of prereq edges
//       connects them (the regular case — NULL counts as a value, so
//       unlabelled quests merge among themselves but never with named
//       parents), OR
//   (c) their parent-bounded chains sit in the same chain-level SCC
//       (chain-level cycles merge).
// Edges that cross parent boundaries one-way (the "hub fanning out to
// several storylines" case) are surfaced as external prereqs so the
// detail page can render an "Unlocked by" / "Unlocks" section without
// merging two storylines into one chain.
//
// Chains of size 1 (an isolated quest with no in-chain edges) are not
// persisted; the smallest persisted chain has two quests.
//
// Edge direction is "prereq → dependent".

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
  /** `parent` (area / storyline) per quest, when known. Two quests sharing
   *  the same value (including both NULL) may be merged into one chain
   *  by their prereq edges; quests with differing parents never merge. */
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
   *  chains have `> 1` of these; fully-cyclic chains have none. Cross-chain
   *  prereqs DO count as incoming edges — a quest unlocked only by a quest
   *  in another chain is not a "start" of this chain. */
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

export interface ComputedExternalEdge {
  /** `'in'`  — an external quest is a prerequisite of one of this chain's
   *           quests. The UI renders these as "Unlocked by".
   *  `'out'` — one of this chain's quests is a prerequisite of an external
   *           quest. The UI renders these as "Unlocks". */
  direction: 'in' | 'out';
  /** The quest in THIS chain that participates in the cross-chain edge. */
  internalQuestId: number;
  /** The quest in the OTHER chain (or unaffiliated) at the other end. */
  externalQuestId: number;
  /** The external quest's chain id, or null when that quest isn't itself
   *  in any chain (size-1 WCC or unknown). */
  externalChainId: number | null;
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
  externalEdges: ComputedExternalEdge[];
}

export function computeQuestChains(input: QuestChainGraphInput): ComputedQuestChain[] {
  const { questIds, edges, questNames, questParents } = input;
  if (questIds.length === 0) return [];

  // Directed adjacency + per-node incoming count for root detection. `out`
  // keys also serve as the "known quest" set. `incomingCount` includes
  // cross-chain edges by design (a quest gated by an external quest isn't
  // a chain start), matching the user-facing definition of "a quest you
  // can start with".
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

  // Global Tarjan SCC over the full directed graph. Two roles:
  //   1. Drives the force-union step below — any multi-quest SCC is a
  //      cycle, and a cycle's members must share a chain regardless of
  //      their `parent` values.
  //   2. Provides per-chain cycle detection and `scc_id` assignment
  //      without each chain having to re-run Tarjan locally.
  const sccs = tarjanScc(questIds, out);
  const sccIndexOf = new Map<number, number>();
  for (let i = 0; i < sccs.length; i++) {
    for (const q of sccs[i]) sccIndexOf.set(q, i);
  }

  const parentOf = (id: number): string | null => questParents.get(id) ?? null;
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

  // Pre-pass: force-union every multi-quest SCC. A cycle that spans
  // parent boundaries (e.g. quest A in parent P1 unlocks quest B in P2,
  // and B unlocks A) must produce one chain — splitting it would render
  // two chains that mutually gate each other with no entry point. Singleton
  // SCCs (including self-loops) don't need force-union; the parent-bounded
  // pass below handles them.
  for (const scc of sccs) {
    if (scc.length <= 1) continue;
    for (let i = 1; i < scc.length; i++) union(scc[0], scc[i]);
  }

  // Main pass: parent-bounded union. Two quests with the same non-null
  // parent can be merged; two NULL-parent quests can be merged via the
  // fallback; a NULL-parent quest never merges with a non-NULL one (the
  // parent values differ). Cross-parent edges that aren't already merged
  // by the force-union above are surfaced as external prereqs later.
  for (const e of dedupedEdges) {
    if (parentOf(e.from) === parentOf(e.to)) union(e.from, e.to);
  }

  // Chain-level SCC pass. The parent-bounded union above can produce
  // chains that mutually gate each other (chain A has a one-way edge to
  // chain B, and chain B has an unrelated one-way edge back to A — no
  // quest-level cycle, but the storylines genuinely interleave). Build
  // the condensed chain-level directed graph and force-union any SCC
  // with more than one chain in it, so interleaved storylines collapse
  // into one chain.
  const chainNodes: number[] = [];
  const chainAdj = new Map<number, number[]>();
  {
    const seenChains = new Set<number>();
    for (const id of questIds) {
      const r = find(id);
      if (seenChains.has(r)) continue;
      seenChains.add(r);
      chainNodes.push(r);
      chainAdj.set(r, []);
    }
    const seenChainEdges = new Set<string>();
    for (const e of dedupedEdges) {
      const a = find(e.from);
      const b = find(e.to);
      if (a === b) continue;
      const key = `${a}>${b}`;
      if (seenChainEdges.has(key)) continue;
      seenChainEdges.add(key);
      chainAdj.get(a)!.push(b);
    }
  }
  const chainSccs = tarjanScc(chainNodes, chainAdj);
  for (const scc of chainSccs) {
    if (scc.length <= 1) continue;
    for (let i = 1; i < scc.length; i++) union(scc[0], scc[i]);
  }

  const wccs = new Map<number, number[]>();
  for (const id of questIds) {
    const r = find(id);
    const arr = wccs.get(r);
    if (arr) arr.push(id);
    else wccs.set(r, [id]);
  }

  // Build the chains. We need each chain's `id` known before attributing
  // external edges, so do the per-WCC pass first and post-process edges
  // after all chains exist.
  const chainsByWcc = new Map<number, ComputedQuestChain>();
  const questToChainId = new Map<number, number>();

  for (const [wccRoot, memberIds] of wccs) {
    if (memberIds.length < 2) continue;
    const memberSet = new Set(memberIds);

    // SCCs touching this WCC. By force-union construction every multi-quest
    // SCC sits entirely within one WCC, so we just collect the SCC indices
    // of this WCC's members.
    const sccsInWcc = new Set<number>();
    for (const q of memberIds) sccsInWcc.add(sccIndexOf.get(q)!);

    // Local scc_id mapping — chain-local 1..N, NULL persistence sentinel 0
    // for non-cyclic singletons.
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

    // Condensation graph (within this WCC). All edges where both endpoints
    // are members count — including the cross-parent edges that were
    // force-unioned via their shared SCC.
    const condOut = new Map<number, Set<number>>();
    const condIncoming = new Map<number, number>();
    for (const gi of sccsInWcc) {
      condOut.set(gi, new Set());
      condIncoming.set(gi, 0);
    }
    for (const e of dedupedEdges) {
      if (!memberSet.has(e.from) || !memberSet.has(e.to)) continue;
      const a = sccIndexOf.get(e.from)!;
      const b = sccIndexOf.get(e.to)!;
      if (a === b) continue;
      const bucket = condOut.get(a)!;
      if (!bucket.has(b)) {
        bucket.add(b);
        condIncoming.set(b, (condIncoming.get(b) ?? 0) + 1);
      }
    }

    // Multi-source BFS from condensation roots → per-SCC depth.
    const sccDepth = new Map<number, number>();
    const queue: number[] = [];
    for (const gi of sccsInWcc) {
      if ((condIncoming.get(gi) ?? 0) === 0) {
        sccDepth.set(gi, 0);
        queue.push(gi);
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
    for (const gi of sccsInWcc) if (!sccDepth.has(gi)) sccDepth.set(gi, 0);

    let maxDepth = 0;
    for (const d of sccDepth.values()) if (d > maxDepth) maxDepth = d;

    // Roots in the user-facing sense: quests with no incoming prereq edges
    // at all. Note this counts cross-chain edges too — a quest gated only
    // by an external quest is NOT a start of this chain. (That external
    // dependency is captured in `externalEdges` below.)
    const roots: number[] = [];
    for (const q of memberIds) {
      if ((incomingCount.get(q) ?? 0) === 0) roots.push(q);
    }
    const rootSet = new Set(roots);

    // Critical path: ancestors of the deepest SCC (tiebroken lowest min id).
    // Scoped to this WCC's SCCs — the global SCC index space includes SCCs
    // from every other chain too, which must not influence this one.
    const condIn = new Map<number, Set<number>>();
    for (const gi of sccsInWcc) condIn.set(gi, new Set());
    for (const [from, tos] of condOut) {
      for (const to of tos) condIn.get(to)!.add(from);
    }
    let finalScc = -1;
    let finalSccDepth = -1;
    let finalSccTiebreak = Infinity;
    for (const gi of sccsInWcc) {
      const d = sccDepth.get(gi) ?? 0;
      const minQ = Math.min(...sccs[gi]);
      if (d > finalSccDepth || (d === finalSccDepth && minQ < finalSccTiebreak)) {
        finalScc = gi;
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

    const chainId = roots.length > 0 ? Math.min(...roots) : Math.min(...memberIds);
    const fallbackName = (id: number): string => questNames.get(id) ?? `Quest ${id}`;
    // Chain name is just the representative quest's name. Cyclicity is an
    // attribute of the chain (`hasCycles`, surfaced via badges and the
    // `Loop` info row), not part of the identifier.
    const name = fallbackName(chainId);
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
      if (!memberSet.has(e.from) || !memberSet.has(e.to)) continue;
      const a = sccIndexOf.get(e.from)!;
      const inCycle =
        a === sccIndexOf.get(e.to) && (sccs[a].length > 1 || e.from === e.to);
      chainEdges.push({ fromQuestId: e.from, toQuestId: e.to, inCycle });
    }

    const chain: ComputedQuestChain = {
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
      externalEdges: [],
    };
    chainsByWcc.set(wccRoot, chain);
    for (const q of memberIds) questToChainId.set(q, chainId);
  }

  // External edges — anything we didn't already attribute to one chain's
  // internal edges. By the parent-bounded union-find rule, these are
  // exactly the edges whose endpoints sit in different WCCs (either
  // different parents, or one side isolated in a size-1 WCC). Each such
  // edge gets recorded from both endpoints' chain perspectives so the
  // detail page can render a coherent "Unlocked by" + "Unlocks" view.
  const chainByQuest = (id: number): ComputedQuestChain | undefined => {
    const wcc = find(id);
    return chainsByWcc.get(wcc);
  };
  for (const e of dedupedEdges) {
    const fromChain = chainByQuest(e.from);
    const toChain = chainByQuest(e.to);
    if (fromChain && toChain && fromChain === toChain) continue; // internal
    if (fromChain) {
      fromChain.externalEdges.push({
        direction: 'out',
        internalQuestId: e.from,
        externalQuestId: e.to,
        externalChainId: toChain?.id ?? null,
      });
    }
    if (toChain) {
      toChain.externalEdges.push({
        direction: 'in',
        internalQuestId: e.to,
        externalQuestId: e.from,
        externalChainId: fromChain?.id ?? null,
      });
    }
  }

  const results = [...chainsByWcc.values()];
  // Stable order — deterministic chain order in tests and before SQL
  // ORDER BY kicks in.
  results.sort((a, b) => a.id - b.id);
  // External edges within a chain: stable order for the detail page.
  for (const c of results) {
    c.externalEdges.sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === 'in' ? -1 : 1;
      if (a.internalQuestId !== b.internalQuestId) return a.internalQuestId - b.internalQuestId;
      return a.externalQuestId - b.externalQuestId;
    });
  }
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
