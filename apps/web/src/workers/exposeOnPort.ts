/// <reference lib="WebWorker" />
import { expose } from 'comlink';

declare const self: DedicatedWorkerGlobalScope;

/** Handoff message: whoever owns the engine transfers a port in on this shape. */
export interface ClientPortMessage {
  scrolledPort: true;
}

/**
 * Engine-worker side of the multi-tab design. The SAHPool VFS needs
 * `FileSystemSyncAccessHandle`, which is `[Exposed=DedicatedWorker]` — so the
 * engine is always a *dedicated* worker and is the single holder of the OPFS
 * connection.
 *
 * It never exposes over its own global scope. Instead its owner — the
 * SharedWorker broker (multi-tab) or the client directly (no-SharedWorker
 * fallback) — transfers a `MessagePort` in, and we `expose(api)` on that port.
 * Every connected tab shares this one `api`, so there is exactly one SQLite
 * connection regardless of how many tabs are open.
 */
export function exposeOnPort(api: object): void {
  self.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as Partial<ClientPortMessage> | null;
    if (!data || data.scrolledPort !== true) return;
    const port = event.ports[0];
    if (!port) return;
    expose(api, port);
    port.start();
  });
}
