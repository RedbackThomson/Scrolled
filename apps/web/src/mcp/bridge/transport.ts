// Transport abstraction for the bridge. The dispatcher reads / writes
// envelopes through this interface and knows nothing about the underlying
// channel — WebSocket, MessagePort, BroadcastChannel, or a test fake all
// implement the same shape. A v1 codebase ships only the WebSocket impl.

import type { BridgeEnvelope } from '@scrolled/mcp-protocol';

export type BridgeStatus = 'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error';

export interface BridgeTransport {
  /** Register the envelope handler. Called once during `startMcpBridge`. */
  onMessage(handler: (env: BridgeEnvelope) => void): void;
  /** Register the status handler. The transport calls it whenever state moves. */
  onStatusChange(handler: (status: BridgeStatus, reason?: string) => void): void;
  /** Open the channel. Resolves once the transport is in `'open'` state, or
   *  rejects if it can't reach that state. Idempotent on already-open. */
  open(): Promise<void>;
  /** Enqueue an envelope. Throws synchronously if the transport isn't open. */
  send(env: BridgeEnvelope): void;
  /** Close the channel; subsequent `send` calls will throw. Idempotent. */
  close(): void;
  /** Read-only status snapshot for the UI indicator. */
  readonly status: BridgeStatus;
}
