import type { Requirement } from '../ir/types';

// Authoring sugar so a requirement list reads like prose:
//   require: [item(4031746, { consumed: true }), level(30)]

export const meso = (amount: number): Requirement => ({ kind: 'meso', amount });

export const item = (
  itemId: number,
  opts?: { consumed?: boolean; quantity?: number },
): Requirement => ({
  kind: 'item',
  itemId,
  consumed: opts?.consumed ?? false,
  ...(opts?.quantity != null ? { quantity: opts.quantity } : {}),
});

export const quest = (questId: number): Requirement => ({ kind: 'quest', questId });

export const level = (min: number): Requirement => ({ kind: 'level', min });
