# @scrolled/mcp-cli

A human-facing CLI for the MCP bridge: list, describe, and invoke the tools a
running browser tab exposes.

**Owns:** the CLI entry (`cli.ts`) and tool-invocation flow (`run.ts`).

**May import:** `@scrolled/mcp-bridge-client` and `@scrolled/mcp-protocol`.

**Imported by:** nothing — it's an executable.
