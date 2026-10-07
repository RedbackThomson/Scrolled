import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type {
  QuestChainEdgeRecord,
  QuestChainExternalEdgeWithName,
  QuestChainMemberWithName,
} from '@/db';

/** Result of laying out a chain via dagre. Coordinates are dagre's centred
 *  positions; the renderer subtracts width/height halves to land each card. */
export interface DagreNode {
  questId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Joined-in from the member row — both displayed in the node card. */
  name: string;
  isRoot: boolean;
  inCycle: boolean;
  /** True when the quest sits on a path to the chain's final quest. The
   *  renderer dims the node when false. */
  isCritical: boolean;
  /** True for nodes that represent a quest in another chain, drawn so the
   *  reader can see what hangs off the edges of this chain. Renderer
   *  ghosts these and links them to the external quest detail. */
  isExternal: boolean;
  /** Set on `isExternal` nodes only — the external chain id (for the
   *  ghost node's link target). Null when the external quest isn't itself
   *  in any chain. */
  externalChainId: number | null;
}

export interface DagreEdge {
  fromQuestId: number;
  toQuestId: number;
  inCycle: boolean;
  /** True when both endpoints are on the critical path. False when either
   *  endpoint is optional — the renderer dims those edges. */
  isCritical: boolean;
  /** True when the edge crosses the parent boundary (one endpoint is a
   *  ghost external node). Renderer dashes these distinctly. */
  isExternal: boolean;
  points: { x: number; y: number }[];
}

export interface DagreLayout {
  nodes: DagreNode[];
  edges: DagreEdge[];
  /** Bounding box including padding so the canvas can size itself. */
  width: number;
  height: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;
const PADDING = 32;

/**
 * Lay out a quest chain with dagre using a left-to-right rank direction.
 * That matches how players read prereq flows ("first quest → next quest"),
 * and stops the layout from getting tall when one chain has 30 quests in a
 * line. Cyclic edges are kept in the graph (dagre is fine with that — it
 * runs an acyclicer pass internally to find a feedback set), and we tag
 * which edges sit in a cycle so the renderer can dash them.
 *
 * External edges (cross-parent prereqs surfaced by the chain pass) are
 * added as ghost nodes anchored to the chain's quests by direction:
 * `'in'` edges become a ghost ancestor on the left of their internal
 * target, `'out'` edges a ghost descendant on the right. Dagre lays them
 * out alongside the real nodes so they fit naturally in the layout — they
 * just render with a ghosted style.
 */
export function useDagreLayout(
  members: readonly QuestChainMemberWithName[],
  edges: readonly QuestChainEdgeRecord[],
  externalEdges: readonly QuestChainExternalEdgeWithName[] = [],
): DagreLayout {
  return useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      nodesep: 24,
      ranksep: 64,
      marginx: PADDING,
      marginy: PADDING,
    });
    g.setDefaultEdgeLabel(() => ({}));
    for (const m of members) {
      g.setNode(String(m.questId), { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const e of edges) {
      g.setEdge(String(e.fromQuestId), String(e.toQuestId), {});
    }

    // Add ghost external nodes. Use a `ext:<id>` key so collisions with
    // internal quest IDs are impossible. One ghost per external quest id
    // (multiple cross-chain edges to the same external quest collapse to
    // a single ghost, matching how the SQL rows are joined).
    const ghostKey = (questId: number) => `ext:${questId}`;
    const ghostInfo = new Map<number, QuestChainExternalEdgeWithName>();
    for (const x of externalEdges) {
      g.setNode(ghostKey(x.externalQuestId), { width: NODE_WIDTH, height: NODE_HEIGHT });
      if (x.direction === 'in') {
        g.setEdge(ghostKey(x.externalQuestId), String(x.internalQuestId), {});
      } else {
        g.setEdge(String(x.internalQuestId), ghostKey(x.externalQuestId), {});
      }
      // Keep the most informative external row per quest id — anything
      // with a non-null chain id wins, since the ghost can then link to
      // the chain. Otherwise first wins.
      const prev = ghostInfo.get(x.externalQuestId);
      if (!prev || (prev.externalChainId === null && x.externalChainId !== null)) {
        ghostInfo.set(x.externalQuestId, x);
      }
    }

    dagre.layout(g);

    const memberById = new Map(members.map((m) => [m.questId, m]));
    const nodes: DagreNode[] = [];
    for (const m of members) {
      const n = g.node(String(m.questId));
      nodes.push({
        questId: m.questId,
        x: n.x,
        y: n.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        name: m.questName,
        isRoot: m.isRoot,
        inCycle: m.sccId !== null,
        isCritical: m.isCritical,
        isExternal: false,
        externalChainId: null,
      });
    }
    for (const [questId, info] of ghostInfo) {
      const n = g.node(ghostKey(questId));
      nodes.push({
        questId,
        x: n.x,
        y: n.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        name: info.externalQuestName ?? `Quest ${questId}`,
        isRoot: false,
        inCycle: false,
        isCritical: false,
        isExternal: true,
        externalChainId: info.externalChainId,
      });
    }

    const outEdges: DagreEdge[] = [];
    for (const e of edges) {
      // dagre.Graph#edge returns undefined for missing edges and the label
      // object (which we mutated with `points`) for present ones. Self-loops
      // collapse to one point; fall back to centring the loop on the node.
      const gEdge = g.edge(String(e.fromQuestId), String(e.toQuestId));
      const points = gEdge?.points ?? [];
      if (points.length === 0 && e.fromQuestId === e.toQuestId) {
        const n = g.node(String(e.fromQuestId));
        if (n) {
          points.push(
            { x: n.x, y: n.y - NODE_HEIGHT / 2 },
            { x: n.x + NODE_WIDTH, y: n.y - NODE_HEIGHT },
            { x: n.x + NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 },
          );
        }
      }
      const fromMember = memberById.get(e.fromQuestId);
      const toMember = memberById.get(e.toQuestId);
      outEdges.push({
        fromQuestId: e.fromQuestId,
        toQuestId: e.toQuestId,
        inCycle: e.inCycle,
        isCritical: !!fromMember?.isCritical && !!toMember?.isCritical,
        isExternal: false,
        points,
      });
    }
    for (const x of externalEdges) {
      const fromKey =
        x.direction === 'in' ? ghostKey(x.externalQuestId) : String(x.internalQuestId);
      const toKey =
        x.direction === 'in' ? String(x.internalQuestId) : ghostKey(x.externalQuestId);
      const gEdge = g.edge(fromKey, toKey);
      const points = gEdge?.points ?? [];
      outEdges.push({
        fromQuestId: x.direction === 'in' ? x.externalQuestId : x.internalQuestId,
        toQuestId: x.direction === 'in' ? x.internalQuestId : x.externalQuestId,
        inCycle: false,
        isCritical: false,
        isExternal: true,
        points,
      });
    }

    const graphSize = g.graph();
    return {
      nodes,
      edges: outEdges,
      width: (graphSize.width ?? 0) + PADDING * 2,
      height: (graphSize.height ?? 0) + PADDING * 2,
    };
  }, [members, edges, externalEdges]);
}
