import { create } from 'zustand';
import { ALL_EQUIP_CLASSES, type EquipClass } from '@/domain/equipJobs';

/**
 * Persistent "who am I playing" preferences. The reward filter on quest
 * pages reads from here so the user picks their class/gender once and
 * every quest list narrows to the rewards they'd actually receive.
 *
 * `null` means "no preference set" — the filter falls through and shows
 * everything. Empty/invalid values in storage are coerced to null on read
 * so a hand-edited localStorage can't poison the UI.
 */
export type Gender = 'male' | 'female';

interface CharacterPreferencesStore {
  /** Player class, or null when the user hasn't picked one. */
  job: EquipClass | null;
  /** Player gender, or null when the user hasn't picked one. */
  gender: Gender | null;
  setJob: (next: EquipClass | null) => void;
  setGender: (next: Gender | null) => void;
  clear: () => void;
}

const JOB_KEY = 'scrolled.character-preferences.job';
const GENDER_KEY = 'scrolled.character-preferences.gender';

function readJob(): EquipClass | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(JOB_KEY);
  return (ALL_EQUIP_CLASSES as readonly string[]).includes(raw ?? '')
    ? (raw as EquipClass)
    : null;
}

function readGender(): Gender | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(GENDER_KEY);
  return raw === 'male' || raw === 'female' ? raw : null;
}

function persistJob(next: EquipClass | null): EquipClass | null {
  if (typeof window === 'undefined') return next;
  if (next === null) window.localStorage.removeItem(JOB_KEY);
  else window.localStorage.setItem(JOB_KEY, next);
  return next;
}

function persistGender(next: Gender | null): Gender | null {
  if (typeof window === 'undefined') return next;
  if (next === null) window.localStorage.removeItem(GENDER_KEY);
  else window.localStorage.setItem(GENDER_KEY, next);
  return next;
}

export const useCharacterPreferences = create<CharacterPreferencesStore>((set) => ({
  job: readJob(),
  gender: readGender(),
  setJob: (next) => set({ job: persistJob(next) }),
  setGender: (next) => set({ gender: persistGender(next) }),
  clear: () => set({ job: persistJob(null), gender: persistGender(null) }),
}));

/**
 * Encode a {@link Gender} as the WZ scalar value the extractor recorded
 * on a reward row: 0 = male, 1 = female, null = no preference. Matches
 * the reward.gender column semantics.
 */
export function genderToWzCode(g: Gender | null): 0 | 1 | null {
  if (g === 'male') return 0;
  if (g === 'female') return 1;
  return null;
}
