// MCP stdio adapter that lives between an MCP client (Claude Desktop, etc.)
// and the Scrolled browser tab. Topology:
//
//   MCP client  <-- stdio MCP -->  this process  <-- localhost WS -->  browser
//
// The browser is authoritative — it owns OPFS, the SQLite WASM workers, the
// tool registry. We just shuttle envelopes. Tool discovery happens once at
// browser-connect time; on disconnect the catalog reverts to the
// `mcp.bridge.status` heartbeat tool so MCP clients can see we're alive.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool as McpTool,
} from '@modelcontextprotocol/sdk/types.js';
import { BridgeHost, type BridgeLogger, type CallToolOutcome } from '@scrolled/mcp-bridge-client';
import type { ToolMetadata } from '@scrolled/mcp-protocol';

export interface McpServerOptions {
  port?: number;
  host?: string;
  logger?: BridgeLogger;
}

const stderrLogger: BridgeLogger = {
  info: (msg, fields) => process.stderr.write(`[mcp] ${msg} ${fmt(fields)}\n`),
  warn: (msg, fields) => process.stderr.write(`[mcp] WARN ${msg} ${fmt(fields)}\n`),
  error: (msg, fields) => process.stderr.write(`[mcp] ERROR ${msg} ${fmt(fields)}\n`),
};

function fmt(fields: Record<string, unknown> | undefined): string {
  if (!fields) return '';
  return JSON.stringify(fields);
}

export async function startMcpServer(opts: McpServerOptions = {}): Promise<void> {
  const logger = opts.logger ?? stderrLogger;

  let catalog: ToolMetadata[] = [];

  const bridge = new BridgeHost({
    port: opts.port,
    host: opts.host,
    logger,
    onClientChange: (connected) => {
      logger.info(connected ? 'tab connected' : 'tab disconnected');
      if (!connected) catalog = [];
    },
  });

  await bridge.start();
  logger.info('bridge ready, waiting for browser tab to connect');

  // Refresh the catalog whenever a tab connects. Best-effort — until the
  // browser side answers, we still serve the bare `bridge.status` heartbeat.
  bridge.start.bind(bridge);
  setInterval(async () => {
    if (!bridge.isClientConnected()) return;
    try {
      const fresh = await bridge.discover();
      catalog = fresh.tools;
    } catch (e) {
      logger.warn('discovery failed', {
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }, 5_000).unref();

  const server = new Server(
    { name: 'scrolled-mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: catalog.map(toMcpTool) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (!bridge.isClientConnected()) {
      return errorResponse(
        'No browser tab is connected to the Scrolled MCP bridge. Open the app and toggle "External Tools" on in Settings.',
      );
    }
    let outcome: CallToolOutcome;
    try {
      outcome = await bridge.callTool(name, args ?? {});
    } catch (e) {
      return errorResponse(e instanceof Error ? e.message : String(e));
    }
    if (outcome.ok) {
      return {
        content: [{ type: 'text', text: JSON.stringify(outcome.result, null, 2) }],
      };
    }
    return errorResponse(`${outcome.error.code}: ${outcome.error.message}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('stdio transport ready');

  const shutdown = async () => {
    logger.info('shutting down');
    await bridge.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function toMcpTool(meta: ToolMetadata): McpTool {
  return {
    name: meta.name,
    description: `[${meta.category}] ${meta.description}`,
    inputSchema:
      (meta.inputSchema as McpTool['inputSchema'] | undefined) ??
      ({ type: 'object' } as McpTool['inputSchema']),
  };
}

function errorResponse(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}
