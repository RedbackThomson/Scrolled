/// <reference lib="WebWorker" />
import type { BrokerMessage, Channel } from './protocol';
import { CHANNELS } from './protocol';

declare const self: SharedWorkerGlobalScope;

// SharedWorker port-broker. It owns no database and spawns no worker — it only
// relays MessagePorts between tabs (which Chromium allows; spawning a Worker
// from a SharedWorker it does not). Per channel it tracks the owner's control
// port and routes follower port-requests to it.

interface ChannelState {
  owner: MessagePort | null;
  /** Requests received before an owner existed; minted once one registers. */
  waiting: Map<string, MessagePort>;
  /** mint-port sent to the owner; awaiting its provide-port reply. */
  awaiting: Map<string, MessagePort>;
}

const channels: Record<Channel, ChannelState> = {
  game: { owner: null, waiting: new Map(), awaiting: new Map() },
  user: { owner: null, waiting: new Map(), awaiting: new Map() },
};

const allPorts = new Set<MessagePort>();

function post(port: MessagePort, msg: BrokerMessage, transfer: Transferable[] = []): void {
  try {
    port.postMessage(msg, transfer);
  } catch {
    // Port is dead (tab gone). Drop it; Web Locks drives real failover.
    allPorts.delete(port);
  }
}

function handle(from: MessagePort, msg: BrokerMessage, transferred: MessagePort | null): void {
  const state = channels[msg.channel];
  switch (msg.kind) {
    case 'register-owner': {
      state.owner = from;
      // Tell every other tab their old port is stale so they reconnect.
      for (const p of allPorts) {
        if (p !== from) post(p, { kind: 'owner-changed', channel: msg.channel });
      }
      // Serve requests that arrived before there was an owner.
      for (const [requestId, follower] of state.waiting) {
        state.awaiting.set(requestId, follower);
        post(from, { kind: 'mint-port', channel: msg.channel, requestId });
      }
      state.waiting.clear();
      break;
    }
    case 'request-port': {
      if (state.owner) {
        state.awaiting.set(msg.requestId, from);
        post(state.owner, { kind: 'mint-port', channel: msg.channel, requestId: msg.requestId });
      } else {
        state.waiting.set(msg.requestId, from);
      }
      break;
    }
    case 'provide-port': {
      const follower = state.awaiting.get(msg.requestId);
      state.awaiting.delete(msg.requestId);
      if (follower && transferred) {
        post(
          follower,
          { kind: 'deliver-port', channel: msg.channel, requestId: msg.requestId },
          [transferred],
        );
      }
      break;
    }
    default:
      break;
  }
}

self.onconnect = (event) => {
  const port = event.ports[0];
  if (!port) return;
  allPorts.add(port);
  port.addEventListener('message', (e: MessageEvent) => {
    const msg = e.data as BrokerMessage;
    if (!msg || !CHANNELS.includes(msg.channel)) return;
    handle(port, msg, e.ports[0] ?? null);
  });
  port.start();
};
