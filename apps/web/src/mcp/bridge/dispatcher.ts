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
        result,
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

void TOOL_VERSION; // keep symbol live for downstream importers
void newEnvelopeId; // exported via index for transport-side reuse
