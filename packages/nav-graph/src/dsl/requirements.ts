import type { Requirement } from '../ir/types';

// Authoring sugar so a requirement list reads like prose:
//   require: [item(4031746, { consumed: true, name: 'Warp Rock' }), level(30)]
//
// `name` on item/quest is the label the UI shows in place of the raw id; omit
// it and the UI falls back to "item #<id>" / "quest #<id>".

export const meso = (amount: number): Requirement => ({ kind: 'meso', amount });

export const item = (
  itemId: number,
  opts?: { consumed?: boolean; quantity?: number; name?: string },
): Requirement => ({
  kind: 'item',
  itemId,
  consumed: opts?.consumed ?? false,
  ...(opts?.quantity != null ? { quantity: opts.quantity } : {}),
  ...(opts?.name != null ? { name: opts.name } : {}),
});

export const quest = (questId: number, name?: string): Requirement => ({
  kind: 'quest',
  questId,
  ...(name != null ? { name } : {}),
});

export const level = (min: number): Requirement => ({ kind: 'level', min });
