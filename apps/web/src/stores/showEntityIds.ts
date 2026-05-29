import { create } from 'zustand';

interface ShowEntityIdsStore {
  /** When true, raw entity IDs are rendered next to names in headers, hover
   *  cards, list rows, and search results. Off by default — most players
   *  don't need them, and tables expose an opt-in ID column for those who do. */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'scrolled.show-entity-ids';

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === 'true';
}

function persist(enabled: boolean): boolean {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  }
  return enabled;
}

export const useShowEntityIds = create<ShowEntityIdsStore>((set, get) => ({
  enabled: readInitial(),
  setEnabled: (next) => set({ enabled: persist(next) }),
  toggle: () => set({ enabled: persist(!get().enabled) }),
}));
