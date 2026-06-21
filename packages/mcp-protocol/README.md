# @scrolled/mcp-protocol

The shared wire format for the MCP bridge that connects the browser tab, the
local server, and the CLI. Intentionally tiny so the three sides can't drift.

**Owns:** the bridge envelope schemas, error codes, tool metadata/categories, and
the protocol/tool version constants.

**May import:** third-party only (`zod`). A leaf package.

**Imported by:** `@scrolled/mcp-bridge-client`, `@scrolled/mcp-server`,
`@scrolled/mcp-cli`, and the web app's MCP bridge.
