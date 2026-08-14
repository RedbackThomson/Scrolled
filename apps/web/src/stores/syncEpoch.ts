import { create } from 'zustand';

interface SyncEpochState {
  epoch: number;
  /** Bump after replacing the user DB wholesale, so the sync engine tears down
   *  and re-reconciles against the account instead of pushing a foreign cursor. */
  invalidate: () => void;
}

export const useSyncEpoch = create<SyncEpochState>((set) => ({
  epoch: 0,
  invalidate: () => set((s) => ({ epoch: s.epoch + 1 })),
}));

export const invalidateSyncEpoch = () => useSyncEpoch.getState().invalidate();
