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
//   3. Serializes calls through a single Promise chain so multi-file drops
//      don't fight for I/O and memory.

import { wrap, type Remote } from 'comlink';
import { createLogger, describeError } from '@/lib/logger';
import type { HashApi } from '@/workers/hashWorker';

const log = createLogger('hash-client');

let cached: { worker: Worker; proxy: Remote<HashApi> } | null = null;

function getClient(): Remote<HashApi> {
  if (!cached) {
    const worker = new Worker(new URL('@/workers/hashWorker.ts', import.meta.url), {
      type: 'module',
      name: 'mge-hash',
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

/** Serializes hash requests behind a single tail promise so we never run
 *  two digests concurrently — they'd compete for disk I/O and double the
 *  peak memory. */
let queueTail: Promise<unknown> = Promise.resolve();

/**
 * SHA-256 of a File or Blob. Returns lowercase hex.
 *
 * Multiple concurrent calls are queued and run one at a time in the
 * worker. Caller can observe queue position via the optional `onQueued` /
 * `onStarted` callbacks (no byte-level progress — the worker reads the
 * file in one shot).
 */
export async function sha256OfFile(
  file: File | Blob,
  callbacks?: { onQueued?: () => void; onStarted?: () => void },
): Promise<string> {
  const client = getClient();
  callbacks?.onQueued?.();
  const myTurn = queueTail.then(() => {
    callbacks?.onStarted?.();
    return client.sha256(file).catch((e) => {
      log.error('worker sha256 failed', describeError(e));
      throw e;
    });
  });
  // Keep the chain alive even if a caller's promise rejects.
  queueTail = myTurn.catch(() => undefined);
  return myTurn as Promise<string>;
}

/** Format the leading bytes of a hash for compact display. */
export function shortHash(hash: string | null | undefined, chars = 12): string {
  if (!hash) return '';
  return hash.slice(0, chars);
}
