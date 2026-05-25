import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeResolved = 'light' | 'dark';

interface ThemeStore {
  /** User preference. */
  mode: ThemeMode;
  /** Effective theme actually applied to the document. */
  theme: ThemeResolved;
  setMode: (mode: ThemeMode) => void;
  /** Cycle: light → dark → system → light. */
  cycle: () => void;
  /** Legacy: explicit light/dark. Equivalent to setMode but typed narrower. */
  set: (theme: ThemeResolved) => void;
  /** Legacy: flip between light and dark (always resolves to an explicit mode). */
  toggle: () => void;
}

const STORAGE_KEY = 'mge.theme';

function readInitial(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function resolve(mode: ThemeMode): ThemeResolved {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return mode;
}

function apply(mode: ThemeMode): ThemeResolved {
  const resolved = resolve(mode);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }
  return resolved;
}

const initialMode = readInitial();
const initialTheme = resolve(initialMode);
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
}

export const useTheme = create<ThemeStore>((set, get) => ({
  mode: initialMode,
  theme: initialTheme,
  setMode: (mode) => set({ mode, theme: apply(mode) }),
  cycle: () => {
    const next: ThemeMode =
      get().mode === 'light' ? 'dark' : get().mode === 'dark' ? 'system' : 'light';
    set({ mode: next, theme: apply(next) });
  },
  set: (theme) => set({ mode: theme, theme: apply(theme) }),
  toggle: () => {
    const next: ThemeResolved = get().theme === 'dark' ? 'light' : 'dark';
    set({ mode: next, theme: apply(next) });
  },
}));

// Subscribe to system preference changes when mode === 'system'.
if (typeof window !== 'undefined') {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (useTheme.getState().mode !== 'system') return;
    const next = systemPrefersDark() ? 'dark' : 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', next === 'dark');
    }
    useTheme.setState({ theme: next });
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange);
  } else {
    // Safari < 14 fallback.
    mql.addListener(onChange);
  }
}
