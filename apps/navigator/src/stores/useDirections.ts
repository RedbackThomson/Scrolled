import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  findPath,
  type NavGraph,
  type NodeId,
  type PathResult,
} from '@scrolled/nav-graph';

/**
 * Traveller-dependent inputs to pathfinding — the things the user declares
 * about their character that change route costs. Grows as we add items and
 * unlocked travel paths; for now it's just the fast-travel ticket. Persisted to
 * localStorage so a character's setup survives refreshes.
 */
export interface PathOptions {
  /** The player holds a fast-travel ticket, making transport hops instant. */
  fastTravel: boolean;
}

const DEFAULT_OPTIONS: PathOptions = { fastTravel: false };

/** The inputs of the last computed route, kept so option changes can recompute. */
interface LastQuery {
  graph: NavGraph;
  from: NodeId;
  to: NodeId;
}

interface DirectionsStore {
  result: PathResult | null;
  options: PathOptions;
  /**
   * Whether the user has seen the path-options menu. Drives the first-load
   * auto-open that nudges people to set their items before Get Directions.
   * Persisted, so the nudge happens once per browser, not every refresh.
   */
  optionsAcknowledged: boolean;
  lastQuery: LastQuery | null;
  /** Compute a path between two nodes with the current options and store it. */
  compute: (graph: NavGraph, from: NodeId, to: NodeId) => void;
  /** Set one pathfinding option; recomputes the current route in place. */
  setOption: <K extends keyof PathOptions>(key: K, value: PathOptions[K]) => void;
  /** Mark the options menu as seen so it stops auto-opening on load. */
  acknowledgeOptions: () => void;
  /** Forget the previous result. Endpoints live in URL state, not here. */
  clear: () => void;
}

function route(query: LastQuery, options: PathOptions): PathResult {
  return findPath(query.graph, query.from, query.to, { fastTravel: options.fastTravel });
}

export const useDirections = create<DirectionsStore>()(
  persist(
    (set, get) => ({
      result: null,
      options: DEFAULT_OPTIONS,
      optionsAcknowledged: false,
      lastQuery: null,
      compute: (graph, from, to) => {
        const query: LastQuery = { graph, from, to };
        set({ lastQuery: query, result: route(query, get().options) });
      },
      setOption: (key, value) => {
        const options = { ...get().options, [key]: value };
        const { lastQuery } = get();
        set({ options, result: lastQuery ? route(lastQuery, options) : get().result });
      },
      acknowledgeOptions: () => set({ optionsAcknowledged: true }),
      clear: () => set({ result: null, lastQuery: null }),
    }),
    {
      name: 'scrolled-navigator-path-options',
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable traveller setup, not the transient route or the
      // graph reference held in lastQuery.
      partialize: (s) => ({ options: s.options, optionsAcknowledged: s.optionsAcknowledged }),
    },
  ),
);
