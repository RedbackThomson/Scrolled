import { create } from 'zustand';
import {
  findPath,
  type NavGraph,
  type NodeId,
  type PathResult,
} from '@scrolled/nav-graph';

interface DirectionsStore {
  result: PathResult | null;
  /** Compute a path between two nodes and store the result. */
  compute: (graph: NavGraph, from: NodeId, to: NodeId) => void;
  /** Forget the previous result. Endpoints live in URL state, not here. */
  clear: () => void;
}

export const useDirections = create<DirectionsStore>((set) => ({
  result: null,
  compute: (graph, from, to) => set({ result: findPath(graph, from, to) }),
  clear: () => set({ result: null }),
}));
