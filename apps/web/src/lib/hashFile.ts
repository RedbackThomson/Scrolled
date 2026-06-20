// Main-thread client for the hash worker.
//
// Hashing big files (Map.wz, Character.wz at ~800 MB) used to happen on the
// main thread and went through three expensive passes: chunked read into
// an array, coalescing memcpy into a contiguous buffer, then `crypto.subtle
// .digest`. With per-chunk progress emitting React re-renders for every
// 64 KB of input — and the wizard kicking off 14 hashes concurrently —
// the main thread became the bottleneck and a single file took minutes.
//
// The current implementation:
//   1. Offloads the actual work to a dedicated Worker (see hashWorker.ts).
//   2. Skips JS-side chunk coalescing by handing `file.arrayBuffer()`
//      straight to `crypto.subtle.digest`.
//   3. Bounds concurrency by total in-flight file bytes (see HASH_BUDGET_BYTES)
//      so multi-file drops parallelize without OOMing the tab. The worker's
//      sha256() is async — multiple in-flight calls overlap their I/O and
//      digest phases on the worker's event loop.

import { wrap, type Remote } from 'comlink';
import { createLogger, describeError } from '@scrolled/extractor/lib/logger';
import type { HashApi } from '@/workers/hashWorker';

const log = createLogger('hash-client');

/**
 * Maximum sum of file sizes we'll let hash concurrently. Sized so a typical
 * dump (Item.wz + String.wz + Mob.wz + Npc.wz + Quest.wz, each in the
 * hundreds of MB) can run together while still leaving headroom on lower-
 * RAM machines. A single file larger than this is still allowed to run —
 * the budget only gates *adding* work, never blocks a lone request.
 */
const HASH_BUDGET_BYTES = 2 * 1024 * 1024 * 1024;

let cached: { worker: Worker; proxy: Remote<HashApi> } | null = null;

function getClient(): Remote<HashApi> {
  if (!cached) {
    const worker = new Worker(new URL('@/workers/hashWorker.ts', import.meta.url), {
      type: 'module',
      name: 'scrolled-hash',
    });
    cached = { worker, proxy: wrap<HashApi>(worker) };
  }
  return cached.proxy;
}

/** Reset the cached worker (used by tests). */
export function terminateHashClient(): void {
  if (cached) {
    cached.worker.terminate();
    cached = null;
  }
}

// -- Bytes-bounded semaphore -------------------------------------------------

interface Waiter {
  size: number;
  resolve: () => void;
}

let inFlightBytes = 0;
const waiters: Waiter[] = [];

function canStart(size: number): boolean {
  // Lone requests always proceed, even if larger than the budget — otherwise
  // a single Map.wz on a low-budget configuration would deadlock.
  if (inFlightBytes === 0) return true;
  return inFlightBytes + size <= HASH_BUDGET_BYTES;
}

function acquire(size: number): Promise<void> {
  if (canStart(size)) {
    inFlightBytes += size;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiters.push({ size, resolve });
  });
}

function release(size: number): void {
  inFlightBytes -= size;
  if (inFlightBytes < 0) inFlightBytes = 0;
  // Scan-and-fit: wake any waiter whose size fits the current free budget.
  // A huge waiter at the head doesn't block smaller ones behind it; if no
  // others are running it'll be eligible via the `inFlightBytes === 0`
  // branch on the next call.
  let i = 0;
  while (i < waiters.length) {
    const w = waiters[i]!;
    if (canStart(w.size)) {
      waiters.splice(i, 1);
      inFlightBytes += w.size;
      w.resolve();
    } else {
      i += 1;
    }
  }
}

/**
 * SHA-256 of a File or Blob. Returns lowercase hex.
 *
 * Multiple concurrent calls run in parallel up to a total in-flight cap
 * of `HASH_BUDGET_BYTES`. Calls beyond that wait until enough running
 * hashes complete to free their share. Observers can pin the transition
 * via `onQueued` (call accepted, may be waiting) / `onStarted` (hash has
 * actually begun).
 */
export async function sha256OfFile(
  file: File | Blob,
  callbacks?: { onQueued?: () => void; onStarted?: () => void },
): Promise<string> {
  const client = getClient();
  const size = file.size;
  callbacks?.onQueued?.();
  await acquire(size);
  try {
    callbacks?.onStarted?.();
    return await client.sha256(file);
  } catch (e) {
    log.error('worker sha256 failed', describeError(e));
    throw e;
  } finally {
    release(size);
  }
}

/** Format the leading bytes of a hash for compact display. */
export function shortHash(hash: string | null | undefined, chars = 12): string {
  if (!hash) return '';
  return hash.slice(0, chars);
}
