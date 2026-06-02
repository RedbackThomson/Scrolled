// Browser-side status broadcaster. The transport updates this; React
// components subscribe via `useBridgeStatus`. Kept as a tiny module-level
// store (not Zustand) because there are at most one transport per session.
//
// The snapshot is a frozen object replaced only when the underlying status
// or reason changes — useSyncExternalStore compares with Object.is, so a
// fresh-object-every-call store would loop forever.

import { useSyncExternalStore } from 'react';
import type { BridgeStatus } from './transport';

export interface BridgeStatusSnapshot {
  readonly status: BridgeStatus;
  readonly reason: string | undefined;
}

let snapshot: BridgeStatusSnapshot = Object.freeze({ status: 'idle', reason: undefined });
const listeners = new Set<() => void>();

export function setBridgeStatus(status: BridgeStatus, reason?: string): void {
  if (snapshot.status === status && snapshot.reason === reason) return;
  snapshot = Object.freeze({ status, reason });
  for (const fn of listeners) fn();
}

export function getBridgeStatus(): BridgeStatusSnapshot {
  return snapshot;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useBridgeStatus(): BridgeStatusSnapshot {
  return useSyncExternalStore(subscribe, getBridgeStatus, getBridgeStatus);
}
