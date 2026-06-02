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
  /**
   * Maximum time the initial `tools/list` response will block waiting for
   * the browser tab to connect. Claude Desktop calls `tools/list` exactly
   * once during the MCP handshake and ignores `tools/list_changed`
   * notifications that arrive afterward, so we must populate before
   * responding. Defaults to 30s; set 0 to disable blocking.
   */
  listToolsWaitMs?: number;
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
  const listToolsWaitMs = opts.listToolsWaitMs ?? 30_000;

  let catalog: ToolMetadata[] = [];
  const clientConnectedWaiters: Array<() => void> = [];

  function notifyClientConnected(): void {
    while (clientConnectedWaiters.length > 0) {
      const fn = clientConnectedWaiters.shift();
      fn?.();
    }
  }

  function waitForClient(timeoutMs: number): Promise<boolean> {
    if (bridge.isClientConnected()) return Promise.resolve(true);
    if (timeoutMs <= 0) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        const idx = clientConnectedWaiters.indexOf(resolveOnce);
        if (idx >= 0) clientConnectedWaiters.splice(idx, 1);
        resolve(false);
      }, timeoutMs);
      const resolveOnce = () => {
        clearTimeout(timer);
        resolve(true);
      };
      clientConnectedWaiters.push(resolveOnce);
    });
  }

  const server = new Server(
    { name: 'scrolled-mcp-server', version: '0.1.0' },
    // `listChanged: true` declares we will emit notifications/tools/list_changed
    // so clients refresh their cached tool list when the browser tab connects.
    { capabilities: { tools: { listChanged: true } } },
  );

  async function refreshCatalog(reason: string): Promise<void> {
    try {
      const fresh = await bridge.discover();
      catalog = fresh.tools;
      logger.info('catalog refreshed', { reason, count: catalog.length });
      try {
        await server.sendToolListChanged();
      } catch (e) {
        logger.warn('failed to emit tools/list_changed', {
          err: e instanceof Error ? e.message : String(e),
        });
      }
    } catch (e) {
      logger.warn('discovery failed', {
        reason,
        err: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const bridge = new BridgeHost({
    port: opts.port,
    host: opts.host,
    logger,
    onClientChange: (connected) => {
      logger.info(connected ? 'tab connected' : 'tab disconnected');
      if (!connected) {
        catalog = [];
        // Tell the MCP client the tool list shrank to nothing so it doesn't
        // hand off stale tool names to the model.
        void server.sendToolListChanged().catch(() => {});
      } else {
        notifyClientConnected();
        // Wait a tick — the browser registers tools synchronously on
        // connect, but the comlink proxies it leans on settle asynchronously.
        setTimeout(() => void refreshCatalog('tab connected'), 100);
      }
    },
  });

  await bridge.start();
  logger.info('bridge ready, waiting for browser tab to connect');

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Claude Desktop calls tools/list exactly once during the handshake
    // and discards `tools/list_changed` notifications received afterward.
    // If we return [] here, the connector stays empty for the entire chat.
    // So block until the browser tab connects, then discover.
    if (catalog.length === 0 && !bridge.isClientConnected()) {
      logger.info('list-tools: waiting for browser tab', { timeoutMs: listToolsWaitMs });
      const connected = await waitForClient(listToolsWaitMs);
      if (!connected) {
        logger.warn('list-tools: timed out, returning empty catalog');
        return { tools: [] };
      }
    }
    if (catalog.length === 0 && bridge.isClientConnected()) {
      await refreshCatalog('list-tools fallback');
    }
    return { tools: catalog.map(toMcpTool) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    if (!bridge.isClientConnected()) {
      return errorResponse(
        'No browser tab is connected to the Scrolled MCP bridge. Open the app and toggle "External Tools" on in Settings.',
      );
    }
    // Claude Desktop validates tool names against ^[a-zA-Z0-9_-]+$ and
    // silently drops anything else, so we expose names with `.` rewritten
    // to `_` on the MCP side and translate back to the registry's stable
    // dotted ids here.
    const registryName = wireNameToRegistryName(name, catalog);
    let outcome: CallToolOutcome;
    try {
      outcome = await bridge.callTool(registryName, args ?? {});
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
  const cleaned = cleanSchemaTree(meta.inputSchema);
  // Tool input schemas must be objects at the root per the MCP spec; coerce
  // here once, NOT recursively (the bug a prior version had — it shoved
  // `type:'object'` into every nested container including `properties`).
  const root =
    cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)
      ? (cleaned as Record<string, unknown>)
      : {};
  if (root.type === undefined) root.type = 'object';
  if (root.type === 'object' && root.properties === undefined) root.properties = {};
  return {
    name: registryNameToWireName(meta.name),
    description: `[${meta.category}] ${meta.description}`,
    inputSchema: root as McpTool['inputSchema'],
    annotations: meta.annotations,
  };
}

/**
 * Strip zod-to-json-schema metadata that breaks MCP clients (Claude
 * Desktop's validator silently drops tools whose schemas declare an
 * incompatible `$schema` URI). Walks the tree without inventing structural
 * fields — every node returned here had to exist in the input.
 */
function cleanSchemaTree(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(cleanSchemaTree);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key === '$schema' || key === 'definitions') continue;
    out[key] = cleanSchemaTree(value);
  }
  return out;
}

/** Rewrite dotted registry ids (`maps.search`) into MCP-safe wire names
 *  (`maps_search`). Reversible because registry names never contain `_`. */
function registryNameToWireName(name: string): string {
  return name.replace(/\./g, '_');
}

/** Reverse {@link registryNameToWireName}. We consult the live catalog so
 *  this stays correct even if a future tool ever does carry an underscore
 *  in its registry id — we'd just find it by exact match first. */
function wireNameToRegistryName(wire: string, catalog: ToolMetadata[]): string {
  if (catalog.some((t) => registryNameToWireName(t.name) === wire)) {
    const hit = catalog.find((t) => registryNameToWireName(t.name) === wire);
    if (hit) return hit.name;
  }
  // Fall back to identity — lets the browser surface a NotFoundError
  // instead of silently rewriting a name the user typed exactly.
  return wire;
}

function errorResponse(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}
