import { useMemo } from 'react';
import dagre from '@dagrejs/dagre';
import type { QuestChainEdgeRecord, QuestChainMemberWithName } from '@/db';

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
}

export interface DagreEdge {
  fromQuestId: number;
  toQuestId: number;
  inCycle: boolean;
  /** True when both endpoints are on the critical path. False when either
   *  endpoint is optional — the renderer dims those edges. */
  isCritical: boolean;
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
const NODE_HEIGHT = 56;
const PADDING = 32;

/**
 * Lay out a quest chain with dagre using a left-to-right rank direction.
 * That matches how players read prereq flows ("first quest → next quest"),
 * and stops the layout from getting tall when one chain has 30 quests in a
 * line. Cyclic edges are kept in the graph (dagre is fine with that — it
 * runs an acyclicer pass internally to find a feedback set), and we tag
 * which edges sit in a cycle so the renderer can dash them.
 */
export function useDagreLayout(
  members: readonly QuestChainMemberWithName[],
  edges: readonly QuestChainEdgeRecord[],
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
    dagre.layout(g);

    const memberById = new Map(members.map((m) => [m.questId, m]));
    const nodes: DagreNode[] = members.map((m) => {
      const n = g.node(String(m.questId));
      return {
        questId: m.questId,
        x: n.x,
        y: n.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        name: m.questName,
        isRoot: m.isRoot,
        inCycle: m.sccId !== null,
        isCritical: m.isCritical,
      };
    });
    const outEdges: DagreEdge[] = edges.map((e) => {
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
      return {
        fromQuestId: e.fromQuestId,
        toQuestId: e.toQuestId,
        inCycle: e.inCycle,
        isCritical: !!fromMember?.isCritical && !!toMember?.isCritical,
        points,
      };
    });

    const graphSize = g.graph();
    return {
      nodes,
      edges: outEdges,
      width: (graphSize.width ?? 0) + PADDING * 2,
      height: (graphSize.height ?? 0) + PADDING * 2,
    };
  }, [members, edges]);
}
