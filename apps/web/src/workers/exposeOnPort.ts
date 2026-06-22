/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import type { EnginePortMessage } from '@/db/multiTab/protocol';

declare const self: DedicatedWorkerGlobalScope;

/**
 * Engine-worker side of the multi-tab design. The SAHPool VFS needs
 * `FileSystemSyncAccessHandle`, which is `[Exposed=DedicatedWorker]` — so the
 * engine is always a dedicated worker and the single holder of the OPFS
 * connection.
 *
 * It never exposes over its own global scope. Its owner (the tab that created
 * it) transfers a `MessagePort` in for itself and one per follower it serves,
 * and we `expose(api)` on each. Every connected tab shares this one `api`, so
 * there is exactly one SQLite connection no matter how many tabs are open.
 */
export function exposeOnPort(api: object): void {
  self.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as Partial<EnginePortMessage> | null;
    if (!data || data.scrolledPort !== true) return;
    const port = event.ports[0];
    if (!port) return;
    expose(api, port);
    port.start();
  });
}
