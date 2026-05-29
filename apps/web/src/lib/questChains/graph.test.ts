import { describe, expect, it } from 'vitest';
import { computeQuestChains, type ComputedQuestChain, type PrereqEdge } from './graph';

interface FixtureInput {
  ids: readonly number[];
  edges: ReadonlyArray<readonly [number, number]>;
  names?: Record<number, string>;
  parents?: Record<number, string | null>;
}

function build({ ids, edges, names, parents }: FixtureInput) {
  return {
    questIds: ids,
    edges: edges.map(([from, to]): PrereqEdge => ({ from, to })),
    questNames: new Map<number, string>(
      Object.entries(names ?? {}).map(([k, v]) => [Number(k), v]),
    ),
    questParents: new Map<number, string | null>(
      Object.entries(parents ?? {}).map(([k, v]) => [Number(k), v]),
    ),
  };
}

function memberMap(chain: ComputedQuestChain) {
  return new Map(chain.members.map((m) => [m.questId, m]));
}

describe('computeQuestChains', () => {
  it('emits no chains for isolated quests (size 1 dropped)', () => {
    const r = computeQuestChains(build({ ids: [1, 2, 3], edges: [] }));
    expect(r).toEqual([]);
  });

  it('linear chain marks every member critical (one root, one final)', () => {
    const r = computeQuestChains(
      build({ ids: [1, 2, 3], edges: [[1, 2], [2, 3]] }),
    );
    expect(r[0].members.every((m) => m.isCritical)).toBe(true);
  });

  it('side branch is optional, main path is critical', () => {
    // A → B → C (main), A → D (side leaf at the same stage as B)
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [2, 3],
          [1, 4],
        ],
        names: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
      }),
    );
    expect(r).toHaveLength(1);
    const m = memberMap(r[0]);
    expect(m.get(1)?.isCritical).toBe(true); // A — on path
    expect(m.get(2)?.isCritical).toBe(true); // B — on path
    expect(m.get(3)?.isCritical).toBe(true); // C — the final quest
    expect(m.get(4)?.isCritical).toBe(false); // D — side branch
  });

  it('diamond keeps both parallel paths critical (any path to D is needed)', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [1, 3],
          [2, 4],
          [3, 4],
        ],
      }),
    );
    expect(r[0].members.every((m) => m.isCritical)).toBe(true);
  });

  it('fully cyclic chain marks every member critical (no skippable quests)', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [2, 3],
          [3, 1],
        ],
      }),
    );
    expect(r[0].members.every((m) => m.isCritical)).toBe(true);
  });

  it('multi-leaf tiebreak picks the lowest-id final (and marks the other leaf optional)', () => {
    // A → B, A → C — B and C are both leaves at stage 1.
    // Lowest-id leaf is B (id 2), so B is the final and C is optional.
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [1, 3],
        ],
      }),
    );
    const m = memberMap(r[0]);
    expect(m.get(1)?.isCritical).toBe(true); // root
    expect(m.get(2)?.isCritical).toBe(true); // final (lowest-id of B, C)
    expect(m.get(3)?.isCritical).toBe(false); // optional sibling
  });

  it('linear chain A → B → C', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [2, 3],
        ],
        names: { 1: 'A', 2: 'B', 3: 'C' },
        parents: { 1: 'Tutorial' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.id).toBe(1);
    expect(c.representativeRootId).toBe(1);
    expect(c.size).toBe(3);
    expect(c.rootCount).toBe(1);
    expect(c.hasCycles).toBe(false);
    expect(c.cycleCount).toBe(0);
    expect(c.maxDepth).toBe(2);
    expect(c.name).toBe('A');
    expect(c.parent).toBe('Tutorial');
    const m = memberMap(c);
    expect(m.get(1)?.depth).toBe(0);
    expect(m.get(2)?.depth).toBe(1);
    expect(m.get(3)?.depth).toBe(2);
    expect(m.get(1)?.isRoot).toBe(true);
    expect(m.get(2)?.isRoot).toBe(false);
    expect(m.get(3)?.isRoot).toBe(false);
    expect(c.edges).toHaveLength(2);
    expect(c.edges.every((e) => !e.inCycle)).toBe(true);
  });

  it('branching A → B, A → C', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [1, 3],
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].rootCount).toBe(1);
    expect(r[0].maxDepth).toBe(1);
    const m = memberMap(r[0]);
    expect(m.get(2)?.depth).toBe(1);
    expect(m.get(3)?.depth).toBe(1);
  });

  it('diamond A → B, A → C, B → D, C → D — D collapses to one slot at depth 2', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [1, 3],
          [2, 4],
          [3, 4],
        ],
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.size).toBe(4);
    expect(c.hasCycles).toBe(false);
    expect(c.maxDepth).toBe(2);
    expect(memberMap(c).get(4)?.depth).toBe(2);
    // D appears only once, not twice (no duplicate members across paths).
    expect(c.members.filter((m) => m.questId === 4)).toHaveLength(1);
  });

  it('pure cycle A → B → C → A — no roots, fully cyclic name', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3],
        edges: [
          [1, 2],
          [2, 3],
          [3, 1],
        ],
        names: { 1: 'A', 2: 'B', 3: 'C' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.id).toBe(1);
    expect(c.rootCount).toBe(0);
    expect(c.hasCycles).toBe(true);
    expect(c.cycleCount).toBe(1);
    expect(c.name).toBe('Loop containing A');
    // Every quest at depth 0 (the lone condensation root SCC contains all of them).
    expect(c.members.every((m) => m.depth === 0)).toBe(true);
    // Every member has a non-null sccId pointing at the same cycle.
    expect(c.members.every((m) => m.sccId !== null)).toBe(true);
    const distinctScc = new Set(c.members.map((m) => m.sccId));
    expect(distinctScc.size).toBe(1);
    expect(c.edges.every((e) => e.inCycle)).toBe(true);
  });

  it('multi-root convergence — chop wood + gather water → go farming → beyond', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 3],
          [2, 3],
          [3, 4],
        ],
        names: { 1: 'Chop wood', 2: 'Gather water', 3: 'Go farming', 4: 'Beyond' },
        parents: { 1: 'Farming', 2: 'Farming', 3: 'Farming', 4: 'Farming' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.size).toBe(4);
    expect(c.rootCount).toBe(2);
    expect(c.id).toBe(1);
    expect(c.name).toBe('Chop wood');
    expect(c.parent).toBe('Farming');
    expect(c.maxDepth).toBe(2);
    const m = memberMap(c);
    expect(m.get(1)?.isRoot).toBe(true);
    expect(m.get(2)?.isRoot).toBe(true);
    expect(m.get(3)?.isRoot).toBe(false);
    expect(m.get(1)?.depth).toBe(0);
    expect(m.get(2)?.depth).toBe(0);
    expect(m.get(3)?.depth).toBe(1);
    expect(m.get(4)?.depth).toBe(2);
  });

  it('disconnected components — two chains', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2, 3, 4],
        edges: [
          [1, 2],
          [3, 4],
        ],
      }),
    );
    expect(r).toHaveLength(2);
    expect(r[0].id).toBe(1);
    expect(r[1].id).toBe(3);
    expect(r[0].size).toBe(2);
    expect(r[1].size).toBe(2);
  });

  it('self-loop A → A plus A → B — A flagged cyclic, B acyclic at depth 1', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2],
        edges: [
          [1, 1],
          [1, 2],
        ],
        names: { 1: 'A', 2: 'B' },
      }),
    );
    expect(r).toHaveLength(1);
    const c = r[0];
    expect(c.size).toBe(2);
    expect(c.hasCycles).toBe(true);
    expect(c.cycleCount).toBe(1);
    // A's self-loop makes it have incoming → not a "root" in the user sense.
    // Same for B (has incoming from A). So the chain reads as fully cyclic
    // from a naming perspective, even though only A is in a cycle.
    expect(c.rootCount).toBe(0);
    expect(c.name).toBe('Loop containing A');
    const m = memberMap(c);
    expect(m.get(1)?.sccId).not.toBeNull();
    expect(m.get(2)?.sccId).toBeNull();
    // Condensation has {A} → {B}, so depth assignment still works.
    expect(m.get(1)?.depth).toBe(0);
    expect(m.get(2)?.depth).toBe(1);
    const selfLoop = c.edges.find((e) => e.fromQuestId === 1 && e.toQuestId === 1);
    expect(selfLoop?.inCycle).toBe(true);
    const cross = c.edges.find((e) => e.fromQuestId === 1 && e.toQuestId === 2);
    expect(cross?.inCycle).toBe(false);
  });

  it('ignores duplicate edges and unknown endpoints', () => {
    const r = computeQuestChains(
      build({
        ids: [1, 2],
        edges: [
          [1, 2],
          [1, 2],
          [99, 1],
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].edges).toHaveLength(1);
  });
});
