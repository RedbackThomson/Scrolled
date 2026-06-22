// Wire protocol for the multi-tab DB sharing layer (docs: wa-sqlite discussion
// #81). One dedicated *engine* worker per origin holds the OPFS connection; it
// is created by the **owner tab's main thread** (a SharedWorker can't spawn a
// Worker in Chromium, and OPFS sync handles don't exist in a SharedWorker). The
// SharedWorker is only a port-broker — it passes MessagePorts between tabs and
// never touches query traffic. Web Locks elect the owner and detect its death.

export type Channel = 'game' | 'user';

export const CHANNELS: readonly Channel[] = ['game', 'user'];

/** Exclusive Web Lock per channel; its holder is that channel's owner tab. */
export const LOCK_NAME: Record<Channel, string> = {
  game: 'scrolled-db-owner-game',
  user: 'scrolled-db-owner-user',
};

/**
 * Engine handoff envelope. The owner posts this to its engine worker with a
 * `MessagePort` in the transfer list; the engine does `expose(api, port)` on it.
 * Sent for the owner's own connection and for each follower the owner serves.
 */
export interface EnginePortMessage {
  scrolledPort: true;
}

/** Control messages between a tab and the SharedWorker broker. */
export type BrokerMessage =
  // tab -> broker: "I just became this channel's owner."
  | { kind: 'register-owner'; channel: Channel }
  // follower -> broker: "I need a port to the engine."
  | { kind: 'request-port'; channel: Channel; requestId: string }
  // broker -> owner: "mint a port for this follower."
  | { kind: 'mint-port'; channel: Channel; requestId: string }
  // owner -> broker: "here's the minted port" (port in transfer list).
  | { kind: 'provide-port'; channel: Channel; requestId: string }
  // broker -> follower: "here's your engine port" (port in transfer list).
  | { kind: 'deliver-port'; channel: Channel; requestId: string }
  // broker -> followers: "the owner changed; your port is dead, reconnect."
  | { kind: 'owner-changed'; channel: Channel };
