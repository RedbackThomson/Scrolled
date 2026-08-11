import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  findPath,
  lockedRequirementsFilter,
  type NavGraph,
  type NodeId,
  type PathResult,
} from '@scrolled/nav-graph';

/**
 * Traveller-dependent inputs to pathfinding — the things the user declares
 * about their character that change route costs and reachability. Persisted to
 * localStorage so a character's setup survives refreshes.
 */
export interface PathOptions {
  /** The player holds a fast-travel ticket, making transport hops instant. */
  fastTravel: boolean;
  /** The player carries return-to-nearest-town scrolls, enabling scroll edges. */
  nearestTownScroll: boolean;
  /**
   * `${kind}:${id}` keys (see `requirementKey`) of the item/quest requirements
   * the traveller has NOT unlocked. Stored as the *excluded* set so the default
   * — empty — means "everything unlocked", and requirements added to the graph
   * later start unlocked without needing a migration of persisted state.
   */
  lockedRequirements: string[];
}

// Most players carry a fast-travel ticket and return scrolls, so both default
// on; the menu (which auto-opens on first visit) lets them opt out. Every
// requirement starts unlocked (nothing locked).
const DEFAULT_OPTIONS: PathOptions = {
  fastTravel: true,
  nearestTownScroll: true,
  lockedRequirements: [],
};

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
  /** Flip one requirement's unlocked state; recomputes the current route. */
  toggleRequirement: (key: string) => void;
  /** Lock or unlock several requirements at once (a group "all"/"none"). */
  setRequirementsLocked: (keys: readonly string[], locked: boolean) => void;
  /** Mark the options menu as seen so it stops auto-opening on load. */
  acknowledgeOptions: () => void;
  /** Forget the previous result. Endpoints live in URL state, not here. */
  clear: () => void;
}

function route(query: LastQuery, options: PathOptions): PathResult {
  return findPath(query.graph, query.from, query.to, {
    fastTravel: options.fastTravel,
    nearestTownScroll: options.nearestTownScroll,
    eligible: lockedRequirementsFilter(new Set(options.lockedRequirements)),
  });
}

/** State patch that applies new options and recomputes the route in place. */
function appliedOptions(
  state: Pick<DirectionsStore, 'options' | 'lastQuery' | 'result'>,
  options: PathOptions,
): Pick<DirectionsStore, 'options' | 'result'> {
  return {
    options,
    result: state.lastQuery ? route(state.lastQuery, options) : state.result,
  };
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
      setOption: (key, value) => set((s) => appliedOptions(s, { ...s.options, [key]: value })),
      toggleRequirement: (key) =>
        set((s) => {
          const locked = new Set(s.options.lockedRequirements);
          if (locked.has(key)) locked.delete(key);
          else locked.add(key);
          return appliedOptions(s, { ...s.options, lockedRequirements: [...locked] });
        }),
      setRequirementsLocked: (keys, locked) =>
        set((s) => {
          const next = new Set(s.options.lockedRequirements);
          for (const key of keys) {
            if (locked) next.add(key);
            else next.delete(key);
          }
          return appliedOptions(s, { ...s.options, lockedRequirements: [...next] });
        }),
      acknowledgeOptions: () => set({ optionsAcknowledged: true }),
      clear: () => set({ result: null, lastQuery: null }),
    }),
    {
      name: 'scrolled-navigator-path-options',
      storage: createJSONStorage(() => localStorage),
      // Persist only the durable traveller setup, not the transient route or the
      // graph reference held in lastQuery.
      partialize: (s) => ({ options: s.options, optionsAcknowledged: s.optionsAcknowledged }),
      // Backfill option fields added after a user first persisted their setup
      // (e.g. lockedRequirements) so older saved state loads with sane defaults.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DirectionsStore>;
        return {
          ...current,
          ...saved,
          options: { ...DEFAULT_OPTIONS, ...(saved.options ?? {}) },
        };
      },
    },
  ),
);
