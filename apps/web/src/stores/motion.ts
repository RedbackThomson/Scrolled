import { create } from 'zustand';

export type Backdrop = 'sky' | 'clouds';

interface MotionPrefs {
  backdrop: Backdrop;
  /** `null` follows the device's reduced-motion preference. */
  drift: boolean | null;
  /** `null` follows the device's reduced-motion preference. */
  motion: boolean | null;
}

interface MotionStore extends MotionPrefs {
  setBackdrop: (backdrop: Backdrop) => void;
  setDrift: (drift: boolean) => void;
  setMotion: (motion: boolean) => void;
}

// Device-local on purpose: reduced motion is a per-device need, so it isn't
// synced with theme and accent.
const STORAGE_KEY = 'scrolled.motion';
const DEFAULTS: MotionPrefs = { backdrop: 'clouds', drift: null, motion: null };

function readInitial(): MotionPrefs {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return DEFAULTS;
    const r = raw as Record<string, unknown>;
    return {
      backdrop: r.backdrop === 'sky' ? 'sky' : 'clouds',
      drift: typeof r.drift === 'boolean' ? r.drift : null,
      motion: typeof r.motion === 'boolean' ? r.motion : null,
    };
  } catch {
    return DEFAULTS;
  }
}

/** `data-motion` on <html> drives the CSS kill switch; absent means "follow the device". */
function apply(prefs: MotionPrefs): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (prefs.motion === null) delete root.dataset.motion;
  else root.dataset.motion = prefs.motion ? 'on' : 'off';
}

function persist(prefs: MotionPrefs): void {
  if (typeof window !== 'undefined')
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  apply(prefs);
}

const initial = readInitial();
apply(initial);

export const useMotion = create<MotionStore>((set, get) => {
  const update = (patch: Partial<MotionPrefs>) => {
    const { backdrop, drift, motion } = { ...get(), ...patch };
    persist({ backdrop, drift, motion });
    set(patch);
  };
  return {
    ...initial,
    setBackdrop: (backdrop) => update({ backdrop }),
    setDrift: (drift) => update({ drift }),
    setMotion: (motion) => update({ motion }),
  };
});
