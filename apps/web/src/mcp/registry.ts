// In-process registry of all MCP tools. The dispatcher and the bridge talk
// to this — nothing else. Tools register themselves once at module load via
// `registerAllTools(registry)`; lookups thereafter are O(1) by tool name.

import { zodToJsonSchema } from 'zod-to-json-schema';
import { PROTOCOL_VERSION, TOOL_VERSION, type ToolMetadata } from '@scrolled/mcp-protocol';
import { NotFoundError, ValidationError, isToolExecutionError, ToolExecutionError } from './errors';
import type { RegisteredTool, ToolContext, ToolDefinition } from './types';

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  /** Register a tool. Replacing an existing name throws — every tool ID is
   *  meant to be stable and globally unique inside the registry. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- registry erases tool generics for storage
  register(tool: ToolDefinition<any, unknown>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    const erased: RegisteredTool = {
      name: tool.name,
      category: tool.category,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      execute: (rawInput: unknown, ctx: ToolContext) =>
        tool.execute(rawInput, ctx) as Promise<unknown>,
    };
    this.tools.set(tool.name, erased);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): RegisteredTool | null {
    return this.tools.get(name) ?? null;
  }

  list(): RegisteredTool[] {
    return Array.from(this.tools.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Metadata catalog for discovery. Schemas are converted to JSON Schema so
   *  non-TS clients (e.g. an MCP host) can consume them. */
  describe(): {
    protocolVersion: number;
    toolVersion: string;
    tools: ToolMetadata[];
  } {
    return {
      protocolVersion: PROTOCOL_VERSION,
      toolVersion: TOOL_VERSION,
      tools: this.list().map((t) => ({
        name: t.name,
        category: t.category,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema, {
          $refStrategy: 'none',
        }) as unknown,
        outputSchema: t.outputSchema
          ? (zodToJsonSchema(t.outputSchema, { $refStrategy: 'none' }) as unknown)
          : undefined,
      })),
    };
  }

  /**
   * Validate input against the tool's schema and call its `execute`. Throws
   * a structured `ToolExecutionError` on validation failure or rethrows the
   * tool's own typed errors. Untyped throws are mapped to `InternalError`
   * upstream by the dispatcher.
   */
  async execute(name: string, rawInput: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new NotFoundError(`Unknown tool: ${name}`);
    }
    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw new ValidationError(`Invalid input for ${name}`, parsed.error.flatten());
    }
    try {
      return await tool.execute(parsed.data, ctx);
    } catch (e) {
      if (isToolExecutionError(e)) throw e;
      throw new ToolExecutionError(
        'InternalError',
        e instanceof Error ? e.message : String(e),
        e instanceof Error && e.stack ? { stack: e.stack } : undefined,
      );
    }
  }
}

let globalRegistry: ToolRegistry | null = null;

/** The process-wide registry. The bridge and the palette provider both
 *  reach for this; tests can swap it via `setToolRegistryForTests`. */
export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) globalRegistry = new ToolRegistry();
  return globalRegistry;
}

export function setToolRegistryForTests(registry: ToolRegistry | null): void {
  globalRegistry = registry;
}
