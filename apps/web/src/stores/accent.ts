import { create } from 'zustand';
import { DEFAULT_ACCENT, isAccentName, type AccentName } from '@/lib/accents';
import { syncThemeColorMeta } from '@/lib/themeColorMeta';
import { getUserDbClient } from '@/db/user';

interface AccentStore {
  accent: AccentName;
  /** User-initiated change — applies locally and persists to the synced
   *  user_settings store. */
  setAccent: (accent: AccentName) => void;
  /** Apply a value loaded from the DB without writing it back (no outbox
   *  churn on every boot). */
  hydrate: (accent: AccentName) => void;
}

// localStorage stays the synchronous boot mirror (no theme flash before the
// user-DB worker answers); user_settings is the synced source of truth.
const STORAGE_KEY = 'scrolled.accent';
export const ACCENT_SETTING_KEY = 'accent';

function readInitial(): AccentName {
  if (typeof window === 'undefined') return DEFAULT_ACCENT;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isAccentName(stored) ? stored : DEFAULT_ACCENT;
}

function apply(accent: AccentName): AccentName {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.accent = accent;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, accent);
  }
  syncThemeColorMeta();
  return accent;
}

const initialAccent = readInitial();
if (typeof document !== 'undefined') {
  document.documentElement.dataset.accent = initialAccent;
  syncThemeColorMeta();
}

export const useAccent = create<AccentStore>((set) => ({
  accent: initialAccent,
  setAccent: (accent) => {
    set({ accent: apply(accent) });
    // Deferred + swallowed so the worker construction never throws into a
    // synchronous caller (or a test env without Workers).
    void Promise.resolve()
      .then(() => getUserDbClient().setUserSetting(ACCENT_SETTING_KEY, JSON.stringify(accent)))
      .catch(() => {});
  },
  hydrate: (accent) => set({ accent: apply(accent) }),
}));
