// Browser-side WebSocket client transport. The browser dials out to a local
// MCP server (which hosts the WS server) — this direction is the only one
// that works because browsers can't accept inbound connections.
//
// Reconnect on transient drops only; the user toggling the bridge off in
// Settings calls `close()` which suppresses retries.

import { bridgeEnvelopeSchema, type BridgeEnvelope } from '@scrolled/mcp-protocol';
import { createLogger } from '@scrolled/game-db/lib/logger';
import type { BridgeStatus, BridgeTransport } from './transport';

const log = createLogger('mcp/ws');

const INITIAL_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;

export interface WebSocketTransportOptions {
  url: string;
  /** Disable reconnect; used by tests and by explicit `close()`. */
  autoReconnect?: boolean;
}

export class WebSocketTransport implements BridgeTransport {
  private readonly url: string;
  private readonly autoReconnect: boolean;
  private socket: WebSocket | null = null;
  private messageHandler: ((env: BridgeEnvelope) => void) | null = null;
  private statusHandler: ((s: BridgeStatus, reason?: string) => void) | null = null;
  private _status: BridgeStatus = 'idle';
  private backoff = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(opts: WebSocketTransportOptions) {
    this.url = opts.url;
    this.autoReconnect = opts.autoReconnect ?? true;
  }

  get status(): BridgeStatus {
    return this._status;
  }

  onMessage(handler: (env: BridgeEnvelope) => void): void {
    this.messageHandler = handler;
  }

  onStatusChange(handler: (s: BridgeStatus, reason?: string) => void): void {
    this.statusHandler = handler;
  }

  async open(): Promise<void> {
    if (this._status === 'open' || this._status === 'connecting') return;
    this.stopped = false;
    await this.connect();
  }

  send(env: BridgeEnvelope): void {
    const sock = this.socket;
    if (!sock || sock.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocketTransport: not open');
    }
    sock.send(JSON.stringify(env));
  }

  close(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('closing');
    this.socket?.close();
    this.socket = null;
    this.setStatus('closed');
  }

  private setStatus(s: BridgeStatus, reason?: string): void {
    if (this._status === s) return;
    this._status = s;
    this.statusHandler?.(s, reason);
  }

  private async connect(): Promise<void> {
    this.setStatus('connecting');
    try {
      const sock = new WebSocket(this.url);
      this.socket = sock;

      sock.addEventListener('open', () => {
        this.backoff = INITIAL_BACKOFF_MS;
        this.setStatus('open');
        log.info('bridge connected', { url: this.url });
      });

      sock.addEventListener('message', (ev) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(ev.data));
        } catch {
          log.warn('non-JSON frame, ignoring');
          return;
        }
        const env = bridgeEnvelopeSchema.safeParse(parsed);
        if (!env.success) {
          log.warn('envelope failed schema, ignoring', { error: env.error.flatten() });
          return;
        }
        this.messageHandler?.(env.data);
      });

      sock.addEventListener('close', (ev) => {
        this.socket = null;
        log.info('bridge closed', { code: ev.code, reason: ev.reason });
        if (this.stopped || !this.autoReconnect) {
          this.setStatus('closed', ev.reason);
          return;
        }
        this.setStatus('closed', ev.reason);
        this.scheduleReconnect();
      });

      sock.addEventListener('error', () => {
        // The `close` listener fires next and owns reconnect scheduling.
        this.setStatus('error', 'WebSocket error');
      });
    } catch (e) {
      this.setStatus('error', e instanceof Error ? e.message : String(e));
      if (this.autoReconnect && !this.stopped) this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopped) return;
      void this.connect();
    }, delay);
  }
}
