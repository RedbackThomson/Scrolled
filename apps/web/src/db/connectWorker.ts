import { wrap, type Remote } from 'comlink';
import type { ClientPortMessage } from '@/workers/exposeOnPort';

export interface WorkerConnection<T> {
  proxy: Remote<T>;
  dispose: () => void;
}

/**
 * Connect to a DB engine, preferring a SharedWorker broker so every tab of the
 * origin shares one engine — and therefore one OPFS connection. OPFS
 * sync-access handles are exclusive per file across the origin, so two
 * independent connections to the same file throw `NoModificationAllowedError`.
 *
 * Falls back to a dedicated engine worker where SharedWorker is unavailable
 * (e.g. Chrome on Android). There each tab gets its own engine, so a second tab
 * can't open the file and lands on the storage-unavailable screen — single-tab
 * use is unaffected.
 *
 * Either way the engine only ever exposes over a transferred `MessagePort`
 * (see `exposeOnPort`): the broker forwards the tab's connect port, and the
 * fallback hands over one end of a fresh `MessageChannel`.
 *
 * `makeBroker`/`makeEngine` are thunks because Vite's worker plugin only
 * bundles a `new SharedWorker`/`new Worker(new URL(...))` whose literal lives at
 * the call site.
 */
export function connectWorker<T>(opts: {
  makeBroker: () => SharedWorker;
  makeEngine: () => Worker;
}): WorkerConnection<T> {
  if (typeof SharedWorker !== 'undefined') {
    const broker = opts.makeBroker();
    broker.port.start();
    return { proxy: wrap<T>(broker.port), dispose: () => broker.port.close() };
  }
  const engine = opts.makeEngine();
  const channel = new MessageChannel();
  engine.postMessage({ scrolledPort: true } satisfies ClientPortMessage, [channel.port2]);
  channel.port1.start();
  return { proxy: wrap<T>(channel.port1), dispose: () => engine.terminate() };
}
