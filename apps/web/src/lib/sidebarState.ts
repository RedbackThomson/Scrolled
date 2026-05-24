import { create } from 'zustand';

interface SidebarStore {
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
}

const STORAGE_KEY = 'mge.sidebar.expanded';

function readInitial(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function persist(state: Record<string, boolean>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const useSidebarSections = create<SidebarStore>((set, get) => ({
  expanded: readInitial(),
  toggle: (key) => {
    const next = { ...get().expanded, [key]: !get().expanded[key] };
    persist(next);
    set({ expanded: next });
  },
}));
