/** Base class for sync failures, so callers can `instanceof`-narrow. */
export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

/**
 * A transient failure (network down, server unreachable). The engine backs off
 * and retries; local writes keep working and the outbox just grows.
 */
export class SyncTransientError extends SyncError {
  constructor(message: string) {
    super(message);
    this.name = 'SyncTransientError';
  }
}

/**
 * The session is no longer valid (401). The engine asks the identity provider
 * to refresh the token once, then surfaces "session expired" if that fails.
 */
export class SyncAuthError extends SyncError {
  constructor(message = 'Sync session expired.') {
    super(message);
    this.name = 'SyncAuthError';
  }
}

/**
 * The client protocol is below the server's `minClientRevision`. Non-retryable
 * — the user must refresh/upgrade. Surfaced, never retried.
 */
export class SyncProtocolError extends SyncError {
  constructor(message: string) {
    super(message);
    this.name = 'SyncProtocolError';
  }
}
