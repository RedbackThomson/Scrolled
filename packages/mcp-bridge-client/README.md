# @scrolled/mcp-bridge-client

The Node-side helper for the MCP bridge: hosts a WebSocket the browser tab dials
into, and exposes a typed client for discovering and calling tools over it.

**Owns:** `BridgeHost`, the call/discovery client, and `CallToolOutcome`.

**May import:** `@scrolled/mcp-protocol` (wire types) and `ws`.

**Imported by:** `@scrolled/mcp-server` and `@scrolled/mcp-cli`.
