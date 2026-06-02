#!/usr/bin/env node
// Bin entry. `pnpm --filter @scrolled/mcp-server start` runs this directly
// via `node --experimental-strip-types`; MCP clients spawn this exact path.

import { startMcpServer } from './server.ts';

const portArg = process.env.MCP_BRIDGE_PORT;
const hostArg = process.env.MCP_BRIDGE_HOST;

startMcpServer({
  port: portArg ? Number(portArg) : undefined,
  host: hostArg,
}).catch((err) => {
  process.stderr.write(`[mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
