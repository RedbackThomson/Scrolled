import { create } from 'zustand';

interface StorageBypassStore {
  bypassed: boolean;
  bypass: () => void;
}

/**
 * Session-only acknowledgement that the user chose to proceed without
 * persistent storage. Deliberately not persisted — like clicking through a
 * browser certificate warning, the choice lasts only until the next reload, so
 * every fresh session re-warns. Reading the page again gives storage another
 * chance to work.
 */
export const useStorageBypass = create<StorageBypassStore>((set) => ({
  bypassed: false,
  bypass: () => set({ bypassed: true }),
}));
