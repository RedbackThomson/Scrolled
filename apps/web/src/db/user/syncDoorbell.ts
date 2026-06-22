// Name of the cross-context doorbell the user-DB worker rings when a local
// mutation appends to the sync outbox (docs/sync_design.md §13). The main-thread
// sync engine host listens on it and debounces a push. A bare constant in its
// own module so both the worker and the main thread can share it without either
// pulling the other's code into its bundle.

export const OUTBOX_DOORBELL_CHANNEL = 'scrolled-user-db-outbox';

/** Payload posted on every outbox append: which entity kind changed, so the
 *  engine can route it to the fast (settings/collections) or lazy (recents)
 *  drain lane. */
export interface OutboxDoorbellMessage {
  entity: string;
}
