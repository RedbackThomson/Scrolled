/// <reference lib="WebWorker" />
import type { ClientPortMessage } from '@/workers/exposeOnPort';

declare const self: SharedWorkerGlobalScope;

/**
 * SharedWorker broker. A SharedWorker can't hold the OPFS connection itself —
 * `FileSystemSyncAccessHandle` is not exposed outside a dedicated worker — so
 * its only job is to own one dedicated *engine* worker and hand each tab's
 * connection port to it. After the handoff the tab talks to the engine directly
 * over that port; the broker does no per-message relaying.
 *
 * `engine` is constructed by the caller because Vite's worker plugin only
 * bundles a `new Worker(new URL(...))` whose literal lives at the call site.
 */
export function runBroker(engine: Worker): void {
  self.onconnect = (event) => {
    const port = event.ports[0];
    if (!port) return;
    engine.postMessage({ scrolledPort: true } satisfies ClientPortMessage, [port]);
  };
}
