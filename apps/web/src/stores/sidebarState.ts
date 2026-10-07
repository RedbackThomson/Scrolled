import { create } from 'zustand';

interface SidebarStore {
  expanded: Record<string, boolean>;
  toggle: (key: string) => void;
}

const STORAGE_KEY = 'scrolled.sidebar.expanded';

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

interface SidebarLayoutStore {
  /** Desktop: render the sidebar as a narrow icon-only rail. Persisted. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
  /** Mobile: the slide-in drawer is open. Not persisted. */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const COLLAPSED_KEY = 'scrolled.sidebar.collapsed';

function readCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(COLLAPSED_KEY) === '1';
}

function persistCollapsed(v: boolean) {
  window.localStorage.setItem(COLLAPSED_KEY, v ? '1' : '0');
}

export const useSidebarLayout = create<SidebarLayoutStore>((set, get) => ({
  collapsed: readCollapsed(),
  toggleCollapsed: () => {
    const next = !get().collapsed;
    persistCollapsed(next);
    set({ collapsed: next });
  },
  setCollapsed: (v) => {
    persistCollapsed(v);
    set({ collapsed: v });
  },
  mobileOpen: false,
  setMobileOpen: (v) => set({ mobileOpen: v }),
}));
