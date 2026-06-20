import { create } from 'zustand';

interface HideMinorPortalsStore {
  /** When true, the Portals section hides spawn points, GM-only portals, and
   *  dead-end teleports — the entries a visitor can't travel through. On by
   *  default; the map detail page exposes a toggle to reveal them. */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
}

const STORAGE_KEY = 'scrolled.hide-minor-portals';

function readInitial(): boolean {
  if (typeof window === 'undefined') return true;
  // Default on: hide unless the user has explicitly turned it off.
  return window.localStorage.getItem(STORAGE_KEY) !== 'false';
}

function persist(enabled: boolean): boolean {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  }
  return enabled;
}

export const useHideMinorPortals = create<HideMinorPortalsStore>((set, get) => ({
  enabled: readInitial(),
  setEnabled: (next) => set({ enabled: persist(next) }),
  toggle: () => set({ enabled: persist(!get().enabled) }),
}));
