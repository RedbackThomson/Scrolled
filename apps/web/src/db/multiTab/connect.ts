import { wrap, type Remote } from 'comlink';
import { createLogger } from '@scrolled/game-db/lib/logger';
import {
  CHANNELS,
  LOCK_NAME,
  type BrokerMessage,
  type Channel,
  type EnginePortMessage,
} from './protocol';

const log = createLogger('db-multitab');

const ENGINE_PORT_MSG: EnginePortMessage = { scrolledPort: true };
const MAX_ATTEMPTS = 4;

/** Thrown internally when a connection is torn down mid-call (owner migrated). */
class TransportReset extends Error {
  constructor() {
    super('db connection reset (owner changed)');
    this.name = 'TransportReset';
  }
}

interface Deferred {
  promise: Promise<never>;
  reject: (e: unknown) => void;
}

function deferred(): Deferred {
  let reject!: (e: unknown) => void;
  const promise = new Promise<never>((_resolve, rej) => {
    reject = rej;
  });
  // Swallow unhandled rejection: this promise is only ever raced against, and a
  // generation with no in-flight call still gets rejected on reset.
  promise.catch(() => undefined);
  return { promise, reject };
}

export interface DbConnection<T> {
  proxy: Remote<T>;
  dispose: () => void;
}

export function multiTabSupported(): boolean {
  return (
    typeof SharedWorker !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.locks &&
    typeof MessageChannel !== 'undefined'
  );
}

// --- shared broker wiring -----------------------------------------------------

let broker: SharedWorker | null = null;
let control: MessagePort | null = null;
const pendingPortRequests = new Map<string, (port: MessagePort) => void>();
const clients = new Map<Channel, ClientHandlers>();

interface ClientHandlers {
  onOwnerChanged: () => void;
  onMintPort: (requestId: string) => void;
}

function ensureBroker(): MessagePort {
  if (control) return control;
  // The `new URL(...)` literal must stay inline here — Vite's worker plugin
  // only bundles a SharedWorker whose URL is at the construction site.
  broker = new SharedWorker(new URL('@/db/multiTab/broker.ts', import.meta.url), {
    type: 'module',
    name: 'scrolled-db-broker',
  });
  control = broker.port;
  control.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as BrokerMessage;
    if (!msg || !CHANNELS.includes(msg.channel)) return;
    if (msg.kind === 'deliver-port') {
      const resolve = pendingPortRequests.get(msg.requestId);
      pendingPortRequests.delete(msg.requestId);
      const port = e.ports[0];
      if (resolve && port) resolve(port);
      return;
    }
    const handlers = clients.get(msg.channel);
    if (!handlers) return;
    if (msg.kind === 'owner-changed') handlers.onOwnerChanged();
    else if (msg.kind === 'mint-port') handlers.onMintPort(msg.requestId);
  });
  control.start();
  return control;
}

function send(msg: BrokerMessage, transfer: Transferable[] = []): void {
  ensureBroker().postMessage(msg, transfer);
}

// --- per-channel client -------------------------------------------------------

class MultiTabClient<T> {
  private engine: Worker | null = null;
  private isOwner = false;
  private remote: Remote<T> | null = null;
  private connectPromise: Promise<Remote<T>> | null = null;
  private generation = 0;
  private abort = deferred();
  private readonly myRequests = new Set<string>();
  readonly proxy: Remote<T>;

  constructor(
    private readonly channel: Channel,
    private readonly makeEngine: () => Worker,
  ) {
    ensureBroker();
    clients.set(channel, {
      onOwnerChanged: () => this.onOwnerChanged(),
      onMintPort: (id) => this.onMintPort(id),
    });
    this.contendForOwnership();
    this.proxy = this.makeProxy();
  }

  private contendForOwnership(): void {
    // Exclusive lock; the holder is this channel's owner. Holding the lock for
    // the tab's lifetime (a promise that never resolves) means the lock only
    // releases when the tab closes — which is exactly the failover signal.
    navigator.locks
      .request(LOCK_NAME[this.channel], () => {
        this.becomeOwner();
        return new Promise<void>(() => undefined);
      })
      .catch((e) => log.warn('lock request ended', { channel: this.channel, err: String(e) }));
  }

  private becomeOwner(): void {
    log.info('became owner', { channel: this.channel });
    this.isOwner = true;
    this.engine = this.makeEngine();
    send({ kind: 'register-owner', channel: this.channel });
    // Drop any follower connection to the previous owner; reconnect goes direct.
    this.reset();
  }

  /** Owner side: mint a fresh engine port for a follower and hand it back. */
  private onMintPort(requestId: string): void {
    if (!this.engine) return;
    const mc = new MessageChannel();
    this.engine.postMessage(ENGINE_PORT_MSG, [mc.port2]);
    send({ kind: 'provide-port', channel: this.channel, requestId }, [mc.port1]);
  }

  private onOwnerChanged(): void {
    log.info('owner changed; reconnecting', { channel: this.channel });
    this.reset();
  }

  private reset(): void {
    this.generation += 1;
    this.remote = null;
    this.connectPromise = null;
    for (const id of this.myRequests) pendingPortRequests.delete(id);
    this.myRequests.clear();
    const prev = this.abort;
    this.abort = deferred();
    prev.reject(new TransportReset());
  }

  private requestFollowerPort(abortPromise: Promise<never>): Promise<MessagePort> {
    const requestId = crypto.randomUUID();
    this.myRequests.add(requestId);
    const got = new Promise<MessagePort>((resolve) => {
      pendingPortRequests.set(requestId, resolve);
      send({ kind: 'request-port', channel: this.channel, requestId });
    });
    return Promise.race([got, abortPromise]).finally(() => this.myRequests.delete(requestId));
  }

  private async establish(): Promise<Remote<T>> {
    const gen = this.generation;
    const abortPromise = this.abort.promise;
    let port: MessagePort;
    if (this.isOwner && this.engine) {
      const mc = new MessageChannel();
      this.engine.postMessage(ENGINE_PORT_MSG, [mc.port2]);
      port = mc.port1;
    } else {
      port = await this.requestFollowerPort(abortPromise);
    }
    if (this.generation !== gen) {
      try {
        port.close();
      } catch {
        /* best effort */
      }
      throw new TransportReset();
    }
    port.start();
    const remote = wrap<T>(port);
    this.remote = remote;
    return remote;
  }

  private ensureRemote(): Promise<Remote<T>> {
    if (this.remote) return Promise.resolve(this.remote);
    if (!this.connectPromise) {
      const p = this.establish();
      this.connectPromise = p;
      p.catch(() => {
        if (this.connectPromise === p) this.connectPromise = null;
      });
    }
    return this.connectPromise;
  }

  private async invoke(prop: string, args: unknown[]): Promise<unknown> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const abortPromise = this.abort.promise;
      let remote: Remote<T>;
      try {
        remote = await this.ensureRemote();
      } catch (e) {
        lastError = e;
        if (e instanceof TransportReset) continue;
        throw e;
      }
      try {
        const fn = (remote as unknown as Record<string, (...a: unknown[]) => unknown>)[prop];
        return await Promise.race([fn.apply(remote, args), abortPromise]);
      } catch (e) {
        lastError = e;
        if (e instanceof TransportReset) continue;
        throw e;
      }
    }
    throw lastError ?? new Error('db connection unavailable');
  }

  private makeProxy(): Remote<T> {
    return new Proxy(Object.create(null) as Remote<T>, {
      get: (_target, prop) => {
        if (typeof prop !== 'string' || prop === 'then') return undefined;
        return (...args: unknown[]) => this.invoke(prop, args);
      },
    });
  }
}

// --- public factory -----------------------------------------------------------

/**
 * Connect to a DB engine shared across tabs (one OPFS connection per origin).
 * The owner tab — elected via Web Locks — creates the dedicated engine worker on
 * its main thread (the only context that can hold an OPFS sync handle and that
 * Chromium lets you create a Worker from); the SharedWorker brokers ports so
 * followers reach that one engine directly. When the owner tab closes, the lock
 * releases, another tab takes over, and followers reconnect transparently.
 *
 * Callers that need the no-multi-tab fallback (no SharedWorker / Web Locks)
 * should branch on `multiTabSupported()` and use a plain worker instead.
 */
export function connectMultiTab<T>(channel: Channel, makeEngine: () => Worker): DbConnection<T> {
  const client = new MultiTabClient<T>(channel, makeEngine);
  return {
    proxy: client.proxy,
    dispose: () => clients.delete(channel),
  };
}

/**
 * Fallback for browsers without SharedWorker / Web Locks: a dedicated engine
 * worker for this tab only. A second tab can't share it and lands on the
 * storage-unavailable screen. The engine still exposes over a transferred port
 * (it never uses its global scope), so we hand it one end of a channel.
 */
export function connectSingleTab<T>(makeEngine: () => Worker): DbConnection<T> {
  const engine = makeEngine();
  const mc = new MessageChannel();
  engine.postMessage(ENGINE_PORT_MSG, [mc.port2]);
  mc.port1.start();
  return {
    proxy: wrap<T>(mc.port1),
    dispose: () => engine.terminate(),
  };
}
