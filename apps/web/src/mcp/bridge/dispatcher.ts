// Transport-agnostic envelope dispatcher. Routes incoming `tool` requests to
// the registry, serializes successes / errors back into the response
// envelope, and answers discovery handshakes. Anything else on the wire is
// ignored — the dispatcher is one-way (request → response); progress events
// flow from the tool back through it when long-running tools start emitting
// them.

import {
  PROTOCOL_VERSION,
  TOOL_VERSION,
  bridgeEnvelopeSchema,
  newEnvelopeId,
  type BridgeEnvelope,
  type ToolError,
} from '@scrolled/mcp-protocol';
import { createLogger } from '@/lib/logger';
import { ToolExecutionError } from '../errors';
import type { ToolRegistry } from '../registry';
import type { ToolContext } from '../types';
import type { BridgeTransport } from './transport';

const log = createLogger('mcp/bridge');

export interface DispatcherOptions {
  registry: ToolRegistry;
  context: ToolContext;
  transport: BridgeTransport;
}

export class BridgeDispatcher {
  private readonly registry: ToolRegistry;
  private readonly context: ToolContext;
  private readonly transport: BridgeTransport;

  constructor(opts: DispatcherOptions) {
    this.registry = opts.registry;
    this.context = opts.context;
    this.transport = opts.transport;
    this.transport.onMessage((env) => this.handle(env));
  }

  private handle(raw: BridgeEnvelope): void {
    const parsed = bridgeEnvelopeSchema.safeParse(raw);
    if (!parsed.success) {
      log.warn('dropping malformed envelope', { error: parsed.error.flatten() });
      return;
    }
    const env = parsed.data;

    switch (env.kind) {
      case 'tool':
        void this.dispatchTool(env.id, env.tool, env.input);
        return;
      case 'discoverRequest':
        this.dispatchDiscover(env.id);
        return;
      // Responses and progress events shouldn't arrive at the browser side
      // — they're emitted, not consumed — but we tolerate them silently
      // rather than crash the transport.
      case 'response':
      case 'discoverResponse':
      case 'progress':
        return;
    }
  }

  private async dispatchTool(id: string, tool: string, input: unknown): Promise<void> {
    try {
      const result = await this.registry.execute(tool, input, this.context);
      this.transport.send({
        v: PROTOCOL_VERSION,
        id,
        kind: 'response',
        success: true,
        result: stripBinary(result),
      });
    } catch (e) {
      const error: ToolError =
        e instanceof ToolExecutionError
          ? { code: e.code, message: e.message, details: e.details }
          : {
              code: 'InternalError',
              message: e instanceof Error ? e.message : String(e),
            };
      this.transport.send({
        v: PROTOCOL_VERSION,
        id,
        kind: 'response',
        success: false,
        error,
      });
    }
  }

  private dispatchDiscover(id: string): void {
    const catalog = this.registry.describe();
    this.transport.send({
      v: PROTOCOL_VERSION,
      id,
      kind: 'discoverResponse',
      protocolVersion: catalog.protocolVersion,
      toolVersion: catalog.toolVersion,
      tools: catalog.tools,
    });
  }
}

/** Helper for tests / unsolicited browser-side emits. Currently unused but
 *  defined alongside the dispatcher so its envelope shape stays in one place. */
export function newProgressEnvelope(forId: string, pct: number, message?: string): BridgeEnvelope {
  return {
    v: PROTOCOL_VERSION,
    id: forId,
    kind: 'progress',
    pct,
    message,
  };
}

/**
 * Drop any binary buffer (Uint8Array, other typed arrays, ArrayBuffer,
 * DataView) inside a tool result before it crosses the wire. JSON.stringify
 * of a Uint8Array balloons into `{"0":1,"1":2,…}` — a 50KB icon blob
 * becomes hundreds of kilobytes of useless JSON. None of the registered
 * tools' downstream consumers need raw bytes; an MCP client that wants an
 * icon should fetch it through the web UI, not the LLM.
 *
 * Fields holding binary values are *omitted* rather than nulled so the wire
 * payload reads "this field is not transmitted" rather than "this field is
 * absent" — null on `iconData` is ambiguous about whether the item has no
 * icon or whether the data was stripped.
 *
 * Top-level binary values (rare — no tool currently returns one) collapse
 * to `null`; binary array elements likewise become `null` so element
 * indices stay stable.
 *
 * Exported for the unit test.
 */
export function stripBinary(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isBinary(value)) return null;
  if (Array.isArray(value)) {
    return value.map((v) => (isBinary(v) ? null : stripBinary(v)));
  }
  if (typeof value === 'object' && isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isBinary(v)) continue; // omit the key entirely
      out[k] = stripBinary(v);
    }
    return out;
  }
  // Class instances (Date, Map, Set, …) pass through unchanged — recursing
  // via Object.entries would treat their non-enumerable internals as an
  // empty object and lose the value.
  return value;
}

function isBinary(value: unknown): boolean {
  if (value instanceof ArrayBuffer) return true;
  return ArrayBuffer.isView(value); // Uint8Array, DataView, etc.
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

void TOOL_VERSION; // keep symbol live for downstream importers
void newEnvelopeId; // exported via index for transport-side reuse
