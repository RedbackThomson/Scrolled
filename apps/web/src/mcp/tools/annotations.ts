// Shared annotation presets. Every Scrolled tool falls into one of four
// behavioural buckets, so each tool file imports the right constant rather
// than hand-rolling the same `{ readOnlyHint, openWorldHint, … }` object.
//
// All tools run against local OPFS-backed SQLite, so `openWorldHint` is
// always false. `destructiveHint` and `idempotentHint` only carry meaning
// when `readOnlyHint` is false.

import type { ToolAnnotations } from '../types';

/** Read-only — search, get, list, status. */
export const READ: ToolAnnotations = Object.freeze({
  readOnlyHint: true,
  openWorldHint: false,
});

/**
 * Write whose re-application with the same arguments converges on the same
 * state — update, rename, reorder, setX, addEntity (no-op on re-add), etc.
 */
export const WRITE_IDEMPOTENT: ToolAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});

/**
 * Write that produces a new row each time — `create` style. Re-running with
 * the same args creates additional records.
 */
export const WRITE_NEW: ToolAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
});

/**
 * Destructive write — delete, removeEntity, import-that-can-overwrite.
 * Clients should surface a confirmation prompt before invoking.
 */
export const DESTRUCTIVE: ToolAnnotations = Object.freeze({
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
});
