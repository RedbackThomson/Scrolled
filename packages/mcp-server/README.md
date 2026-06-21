# @scrolled/mcp-server

A local MCP server that bridges the browser tab to MCP-speaking clients (Claude
Desktop, etc.). It holds two transports: a WebSocket to the browser and MCP stdio
upstream.

**Owns:** the CLI entry (`cli.ts`) and the stdio server logic (`server.ts`).

**May import:** `@scrolled/mcp-bridge-client`, `@scrolled/mcp-protocol`,
`@modelcontextprotocol/sdk`, `ws`, `zod`.

**Imported by:** nothing — it's an executable.
