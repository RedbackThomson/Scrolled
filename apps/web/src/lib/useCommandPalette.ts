import { create } from 'zustand';
import type {
  CommandItem,
  PalettePageContext,
  PaletteSelection,
} from '@/components/command-palette/types';

interface CommandPaletteState {
  open: boolean;
  query: string;
  pageContext: PalettePageContext | null;
  contextItems: CommandItem[];
  selection: PaletteSelection | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setQuery: (q: string) => void;
  setPageContext: (ctx: PalettePageContext | null) => void;
  setContextItems: (items: CommandItem[]) => void;
  setSelection: (sel: PaletteSelection | null) => void;
}

export const useCommandPalette = create<CommandPaletteState>((set) => ({
  open: false,
  query: '',
  pageContext: null,
  contextItems: [],
  selection: null,
  setOpen: (open) => set({ open, query: open ? '' : '' }),
  toggle: () => set((s) => ({ open: !s.open, query: '' })),
  setQuery: (query) => set({ query }),
  setPageContext: (pageContext) => set({ pageContext }),
  setContextItems: (contextItems) => set({ contextItems }),
  setSelection: (selection) => set({ selection }),
}));
