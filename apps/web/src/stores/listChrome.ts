import { create } from 'zustand';

/** What a list page puts in the phone top bar in place of the global search pill. */
export interface ListSearchChrome {
  placeholder: string;
  open: () => void;
}

export interface ListSelectionChrome {
  count: number;
  total: number;
  allMatching: boolean;
  selectAll: () => void;
  exit: () => void;
}

interface ListChromeStore {
  search: ListSearchChrome | null;
  selection: ListSelectionChrome | null;
  setSearch: (search: ListSearchChrome | null) => void;
  setSelection: (selection: ListSelectionChrome | null) => void;
}

/**
 * Phone list pages take over the top bar: its pill opens the page's own
 * search, and while rows are being selected it becomes the selection bar.
 * The page sets these while mounted and clears them on unmount.
 */
export const useListChrome = create<ListChromeStore>((set) => ({
  search: null,
  selection: null,
  setSearch: (search) => set({ search }),
  setSelection: (selection) => set({ selection }),
}));
