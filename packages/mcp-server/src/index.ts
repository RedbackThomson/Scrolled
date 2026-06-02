// MCP server entry. Exports `startMcpServer` so other packages can embed it;
// the bin script in `./cli.ts` is the human-facing entry point.

export { startMcpServer, type McpServerOptions } from './server.ts';
