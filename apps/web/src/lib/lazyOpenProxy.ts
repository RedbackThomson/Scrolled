// Eliminates the per-method facade workers used to wrap their `*Api`
// surfaces. Each method on the wrapped API is forwarded automatically; a
// new method on the underlying class is immediately callable through
// comlink with no separate registration step — which is the property the
// old hand-written facades kept losing.

import { describeError, type Logger } from './logger';

export interface OpenableApi {
  /** Idempotent: implementations must safely tolerate a duplicate call
   *  (the proxy calls it once on first dispatch, and routes a caller's own
   *  `open()` invocation through the same path). */
  open(): Promise<unknown>;
}

/**
 * Wrap an API so every method call awaits `open()` first. The open promise
 * is memoised; on rejection it's cleared so the next call retries. Methods
 * on the API surface forward automatically — comlink's `expose()` sees the
 * proxy and dispatches every property access through `Reflect.get`, so
 * adding a method to the underlying class needs no change here.
 *
 * Pass a `Logger` to record open failures with the worker's normal tag.
 */
export function lazyOpenProxy<T extends OpenableApi>(api: T, log?: Logger): T {
  let opened: Promise<void> | null = null;
  const ensureOpen = (): Promise<void> => {
    if (!opened) {
      opened = api.open().then(
        () => undefined,
        (e) => {
          log?.error('open failed', describeError(e));
          opened = null;
          throw e;
        },
      );
    }
    return opened;
  };

  return new Proxy(api, {
    get(target, prop, receiver) {
      // Returning a value for `then` would make comlink (and any plain
      // `await` on the proxy) treat it as thenable. Mask it to undefined.
      if (prop === 'then') return undefined;
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return async (...args: unknown[]) => {
        await ensureOpen();
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as T;
}
