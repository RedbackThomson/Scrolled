// Ring-buffer logger.
//
// Used everywhere in the parser pipeline. Entries are kept in memory (capped),
// mirrored to the console, and can be dumped as text for bug reports. The
// logger lives in both the main thread and the Worker — each side has its own
// buffer; `getDiagnostics()` on the parser client merges them by timestamp.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** Unix epoch milliseconds. */
  t: number;
  scope: string;
  level: LogLevel;
  msg: string;
  /** Optional structured payload; must be structured-cloneable. */
  data?: unknown;
}

const BUFFER_SIZE = 2000;
const buffer: LogEntry[] = [];

function debugEnabled(): boolean {
  try {
    return (
      (globalThis as { localStorage?: Storage }).localStorage?.getItem('scrolled.debug') === '1'
    );
  } catch {
    return false;
  }
}

function record(scope: string, level: LogLevel, msg: string, data?: unknown): void {
  // Debug entries are firehose-y (e.g. one per getNode call inside the parser
  // worker). Without gating them, a single extraction run can evict 500
  // useful INFO/WARN entries before the user even opens the diagnostics
  // panel. Keep debug in the ring buffer only when scrolled.debug=1 is set, but
  // still mirror to the console so live debugging in DevTools works.
  if (level !== 'debug' || debugEnabled()) {
    const entry: LogEntry = { t: Date.now(), scope, level, msg };
    if (data !== undefined) entry.data = data;
    buffer.push(entry);
    if (buffer.length > BUFFER_SIZE) buffer.shift();
  }

  if (level === 'debug' && !debugEnabled()) return;
  const fn = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
  console[fn](`[scrolled:${scope}] ${msg}`, data ?? '');
}

export interface Logger {
  debug(msg: string, data?: unknown): void;
  info(msg: string, data?: unknown): void;
  warn(msg: string, data?: unknown): void;
  error(msg: string, data?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, data) => record(scope, 'debug', msg, data),
    info: (msg, data) => record(scope, 'info', msg, data),
    warn: (msg, data) => record(scope, 'warn', msg, data),
    error: (msg, data) => record(scope, 'error', msg, data),
  };
}

/** Snapshot of the in-memory buffer. */
export function getLogEntries(): LogEntry[] {
  return buffer.slice();
}

export function clearLog(): void {
  buffer.length = 0;
}

/** Best-effort error → plain JSON conversion for logging across the worker boundary. */
export function describeError(e: unknown): { name?: string; message: string; stack?: string } {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack };
  }
  return { message: String(e) };
}
