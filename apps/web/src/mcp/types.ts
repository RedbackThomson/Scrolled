// In-process tool contract. Tools are thin Zod-validated adapters over the
// existing DbApi / UserDbApi surfaces; the registry holds them in one Map and
// the dispatcher fans bridge envelopes through it. Nothing here knows about
// MCP, WebSockets, or the CLI — those plug in at the bridge layer.

import type { Remote } from 'comlink';
import type { ZodTypeAny, z } from 'zod';
import type { ToolCategory, ToolMetadata } from '@scrolled/mcp-protocol';
import type { GameDatabase } from '@/db';
import type { UserDatabase } from '@/db/user';
import type { McpServices } from './services';

export type { ToolCategory, ToolMetadata } from '@scrolled/mcp-protocol';

export interface ToolContext {
  db: Remote<GameDatabase>;
  userDb: Remote<UserDatabase>;
  services: McpServices;
}

/**
 * A registered tool. `inputSchema` validates the raw envelope input; the
 * inferred `TInput` is what `execute` receives. `outputSchema` is optional
 * — used today only for tool catalog metadata; the dispatcher does not
 * re-validate outputs (tools return DB rows whose shape is already trusted).
 */
export interface ToolDefinition<TInputSchema extends ZodTypeAny, TOutput> {
  name: string;
  category: ToolCategory;
  description: string;
  inputSchema: TInputSchema;
  outputSchema?: ZodTypeAny;
  execute(input: z.infer<TInputSchema>, ctx: ToolContext): Promise<TOutput>;
}

/** A tool that's been registered, with its schema-erased execute signature. */
export interface RegisteredTool {
  name: string;
  category: ToolCategory;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema?: ZodTypeAny;
  execute(input: unknown, ctx: ToolContext): Promise<unknown>;
}

export type ToolMetadataWithSchema = ToolMetadata;
