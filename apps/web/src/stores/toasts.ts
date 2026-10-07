import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

export interface ToastInput {
  message: string;
  icon?: LucideIcon;
  action?: { label: string; run: () => void };
}

export interface ToastEntry extends ToastInput {
  id: number;
}

interface ToastStore {
  toasts: ToastEntry[];
  show: (toast: ToastInput) => void;
  dismiss: (id: number) => void;
}

// Older toasts give way rather than stacking up the screen.
const MAX_TOASTS = 3;
let nextId = 1;

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  show: (toast) =>
    set((s) => ({ toasts: [...s.toasts, { ...toast, id: nextId++ }].slice(-MAX_TOASTS) })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const showToast = (toast: ToastInput) => useToasts.getState().show(toast);
