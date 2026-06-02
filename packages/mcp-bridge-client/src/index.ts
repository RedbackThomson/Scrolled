// Node-side bridge helper. Hosts a WebSocket server that the Scrolled
// browser tab dials into. Consumers (the MCP server adapter, the CLI)
// import `BridgeHost`, call `start()`, then await `discover()` / `callTool()`.
// Everything else — pending-request tracking, envelope routing, JSON
// serialization — is owned here so the two consumers don't reimplement it.

import { WebSocketServer, type WebSocket } from 'ws';
import {
  PROTOCOL_VERSION,
  bridgeEnvelopeSchema,
  newEnvelopeId,
  type BridgeEnvelope,
  type ToolError,
  type ToolMetadata,
} from '@scrolled/mcp-protocol';

const DEFAULT_PORT = 8765;
const DEFAULT_DISCOVERY_TIMEOUT_MS = 10_000;
const DEFAULT_CALL_TIMEOUT_MS = 60_000;

export interface BridgeHostOptions {
  port?: number;
  host?: string;
  /** How long `discover()` / `callTool()` wait for a response before rejecting. */
  callTimeoutMs?: number;
  discoveryTimeoutMs?: number;
  /** Notified when a browser connects/disconnects. */
  onClientChange?: (connected: boolean) => void;
  /** Optional progress relay for long-running tools. Forwarded as-is to callers. */
  onProgress?: (forId: string, pct: number | undefined, message: string | undefined) => void;
  logger?: BridgeLogger;
}

export interface BridgeLogger {
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

const noopLogger: BridgeLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

interface PendingRequest {
  resolve(result: unknown): void;
  reject(error: Error): void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface CallToolResult {
  ok: true;
  result: unknown;
}

export interface CallToolFailure {
  ok: false;
  error: ToolError;
}

export type CallToolOutcome = CallToolResult | CallToolFailure;

export class BridgeHost {
  private readonly opts: Required<
    Omit<BridgeHostOptions, 'onClientChange' | 'onProgress' | 'logger'>
  > &
    Pick<BridgeHostOptions, 'onClientChange' | 'onProgress' | 'logger'>;
  private wss: WebSocketServer | null = null;
  private client: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private log: BridgeLogger;

  constructor(opts: BridgeHostOptions = {}) {
    this.opts = {
      port: opts.port ?? DEFAULT_PORT,
      host: opts.host ?? '127.0.0.1',
      callTimeoutMs: opts.callTimeoutMs ?? DEFAULT_CALL_TIMEOUT_MS,
      discoveryTimeoutMs: opts.discoveryTimeoutMs ?? DEFAULT_DISCOVERY_TIMEOUT_MS,
      onClientChange: opts.onClientChange,
      onProgress: opts.onProgress,
      logger: opts.logger,
    };
    this.log = opts.logger ?? noopLogger;
  }

  /** Begin listening for browser connections. Resolves once the server is up. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wss = new WebSocketServer({ port: this.opts.port, host: this.opts.host });
      wss.once('listening', () => {
        this.log.info('bridge listening', {
          host: this.opts.host,
          port: this.opts.port,
        });
        resolve();
      });
      wss.once('error', reject);
      wss.on('connection', (ws) => this.attach(ws));
      this.wss = wss;
    });
  }

  /** Stop the WS server and reject any pending requests. */
  async stop(): Promise<void> {
    for (const [, p] of this.pending) {
      clearTimeout(p.timeoutId);
      p.reject(new Error('Bridge stopped'));
    }
    this.pending.clear();
    if (this.client && this.client.readyState === this.client.OPEN) this.client.close();
    this.client = null;
    if (!this.wss) return;
    const wss = this.wss;
    this.wss = null;
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
  }

  /** True iff a browser tab is currently connected. */
  isClientConnected(): boolean {
    return this.client !== null && this.client.readyState === this.client.OPEN;
  }

  /** Ask the connected browser for its tool catalog. Rejects if no client
   *  is connected or the response doesn't arrive within the timeout. */
  async discover(): Promise<{
    protocolVersion: number;
    toolVersion: string;
    tools: ToolMetadata[];
  }> {
    if (!this.client || this.client.readyState !== this.client.OPEN) {
      throw new Error('No browser client connected');
    }
    const id = newEnvelopeId();
    const req: BridgeEnvelope = {
      v: PROTOCOL_VERSION,
      id,
      kind: 'discoverRequest',
    };
    const promise = this.awaitResponse(id, this.opts.discoveryTimeoutMs);
    this.client.send(JSON.stringify(req));
    return (await promise) as {
      protocolVersion: number;
      toolVersion: string;
      tools: ToolMetadata[];
    };
  }

  /** Invoke a tool. Resolves with the success / error union; never throws
   *  on a tool-level error (those become `ok: false`), only on transport
   *  failures or timeouts. */
  async callTool(tool: string, input: unknown): Promise<CallToolOutcome> {
    if (!this.client || this.client.readyState !== this.client.OPEN) {
      throw new Error('No browser client connected');
    }
    const id = newEnvelopeId();
    const req: BridgeEnvelope = {
      v: PROTOCOL_VERSION,
      id,
      kind: 'tool',
      tool,
      input,
    };
    const promise = this.awaitResponse(id, this.opts.callTimeoutMs);
    this.client.send(JSON.stringify(req));
    return (await promise) as CallToolOutcome;
  }

  private awaitResponse(id: string, timeoutMs: number): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Bridge timeout after ${timeoutMs}ms (id=${id})`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeoutId });
    });
  }

  private attach(ws: WebSocket): void {
    if (this.client && this.client.readyState === this.client.OPEN) {
      this.log.warn('rejecting second browser connection');
      ws.close(4001, 'Another browser tab is already bridged');
      return;
    }
    this.client = ws;
    this.opts.onClientChange?.(true);
    this.log.info('browser connected');

    ws.on('message', (data) => this.handleMessage(data));
    ws.on('close', () => {
      this.log.info('browser disconnected');
      if (this.client === ws) {
        this.client = null;
        this.opts.onClientChange?.(false);
      }
    });
    ws.on('error', (err) => {
      this.log.warn('socket error', { err: err.message });
    });
  }

  private handleMessage(data: unknown): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(data));
    } catch (e) {
      this.log.warn('non-JSON frame, ignoring', {
        err: e instanceof Error ? e.message : String(e),
      });
      return;
    }
    const envParse = bridgeEnvelopeSchema.safeParse(parsed);
    if (!envParse.success) {
      this.log.warn('envelope failed schema, ignoring', {
        error: envParse.error.flatten(),
      });
      return;
    }
    const env = envParse.data;
    switch (env.kind) {
      case 'response': {
        const pend = this.pending.get(env.id);
        if (!pend) return;
        this.pending.delete(env.id);
        clearTimeout(pend.timeoutId);
        if (env.success) pend.resolve({ ok: true, result: env.result });
        else pend.resolve({ ok: false, error: env.error });
        return;
      }
      case 'discoverResponse': {
        const pend = this.pending.get(env.id);
        if (!pend) return;
        this.pending.delete(env.id);
        clearTimeout(pend.timeoutId);
        pend.resolve({
          protocolVersion: env.protocolVersion,
          toolVersion: env.toolVersion,
          tools: env.tools,
        });
        return;
      }
      case 'progress':
        this.opts.onProgress?.(env.id, env.pct, env.message);
        return;
      // The browser only sends responses / progress; ignore anything else.
      case 'tool':
      case 'discoverRequest':
        return;
    }
  }
}
