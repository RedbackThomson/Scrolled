// Progress reporting primitives shared across the parser pipeline.
//
// Every long-running operation (file load, extraction, persistence, future
// search-index builds) emits `ProgressUpdate`s through an `onProgress`
// callback. The shape is structured-cloneable so it crosses the comlink
// worker boundary unchanged.

export interface ProgressUpdate {
  /** Human-readable phase, e.g. "Loading String.wz" or "Extracting items". */
  phase: string;
  /** Units processed so far (bytes, items, rows…). */
  current: number;
  /**
   * Total expected units. `undefined` (or `0`) means "indeterminate" — the UI
   * should render an animated bar rather than a percentage.
   */
  total?: number;
  /** Optional sub-context, e.g. an image name or category. */
  detail?: string;
}

export type ProgressFn = (update: ProgressUpdate) => void;

/**
 * Throttle a progress callback so that the actual function is called at most
 * once every `intervalMs`. The trailing-edge call is always preserved, so the
 * final 100%/"done" update still arrives.
 *
 * Use this on the worker side before sending updates through comlink to avoid
 * flooding the message channel with thousands of per-item events.
 */
export function throttleProgress(fn: ProgressFn, intervalMs = 80): ProgressFn {
  let last = 0;
  let pending: ProgressUpdate | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    if (!pending) return;
    last = nowMs();
    const p = pending;
    pending = null;
    fn(p);
  };

  return (update: ProgressUpdate) => {
    pending = update;
    const now = nowMs();
    const elapsed = now - last;
    if (elapsed >= intervalMs) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      const p = pending;
      pending = null;
      fn(p);
    } else if (!timer) {
      timer = setTimeout(flush, intervalMs - elapsed);
    }
  };
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
