// Wire-format contract for the Scrolled MCP bridge.
//
// Three sides of the bridge — the browser, the local MCP server, and the
// CLI — all reach for this package. Pinning the envelope shapes and the
// error code union here is the only reason they cannot drift.
//
// The runtime is intentionally tiny: a few Zod schemas, the inferred types,
// and two version constants. No business logic, no transport code.

import { z } from 'zod';

/** Wire-format version. Bump alongside breaking envelope changes. */
export const PROTOCOL_VERSION = 1;

/**
 * Tool catalog version. Distinct from {@link PROTOCOL_VERSION} so the registry
 * can evolve without bumping the wire format. Surfaced over the bridge as part
 * of the handshake so clients can decide whether to refresh their tool list.
 */
export const TOOL_VERSION = '0.1.0';

/** Categorical buckets surfaced to MCP / CLI for grouped listing. */
export const TOOL_CATEGORIES = [
  'Maps',
  'Items',
  'Equipment',
  'Monsters',
  'NPCs',
  'Quests',
  'QuestChains',
  'Jobs',
  'Skills',
  'Chairs',
  'Search',
  'Collections',
  'Groups',
  'Notes',
  'PinnedSearches',
  'Settings',
  'ServerProfiles',
  'Database',
  'ImportExport',
  'Library',
] as const;

export const toolCategorySchema = z.enum(TOOL_CATEGORIES);
export type ToolCategory = z.infer<typeof toolCategorySchema>;

/**
 * Structured error codes. Bridge handlers map runtime exceptions to one of
 * these; transports must never invent new codes outside this union.
 */
export const ERROR_CODES = [
  'ValidationError',
  'NotFoundError',
  'ConflictError',
  'OperationError',
  'UnsupportedError',
  'InternalError',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const toolErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ToolError = z.infer<typeof toolErrorSchema>;

/**
 * Tool metadata returned by `discover`. Carries only what a generic client
 * needs to render help and validate input shape — schemas cross the wire as
 * JSON Schema (Zod's `toJSONSchema` output) so non-TS clients can use them.
 */
export const toolMetadataSchema = z.object({
  name: z.string(),
  category: toolCategorySchema,
  description: z.string(),
  inputSchema: z.unknown(),
  outputSchema: z.unknown().optional(),
});
export type ToolMetadata = z.infer<typeof toolMetadataSchema>;

const envelopeBase = z.object({
  v: z.number().int(),
  id: z.string(),
});

/** Request: invoke one tool with a JSON-shaped input. */
export const toolRequestEnvelopeSchema = envelopeBase.extend({
  kind: z.literal('tool'),
  tool: z.string(),
  input: z.unknown(),
});
export type ToolRequestEnvelope = z.infer<typeof toolRequestEnvelopeSchema>;

/** Response: success carries the raw result; failure carries a typed error. */
export const toolResponseEnvelopeSchema = z.discriminatedUnion('success', [
  envelopeBase.extend({
    kind: z.literal('response'),
    success: z.literal(true),
    result: z.unknown(),
  }),
  envelopeBase.extend({
    kind: z.literal('response'),
    success: z.literal(false),
    error: toolErrorSchema,
  }),
]);
export type ToolResponseEnvelope = z.infer<typeof toolResponseEnvelopeSchema>;

/** Discovery handshake: client asks, browser returns its tool list. */
export const discoveryRequestEnvelopeSchema = envelopeBase.extend({
  kind: z.literal('discoverRequest'),
});
export type DiscoveryRequestEnvelope = z.infer<typeof discoveryRequestEnvelopeSchema>;

export const discoveryResponseEnvelopeSchema = envelopeBase.extend({
  kind: z.literal('discoverResponse'),
  protocolVersion: z.number().int(),
  toolVersion: z.string(),
  tools: z.array(toolMetadataSchema),
});
export type DiscoveryResponseEnvelope = z.infer<typeof discoveryResponseEnvelopeSchema>;

/**
 * Progress event for long-running operations (imports, exports, reindex).
 * Defined now so the wire format already covers it; v1 tools emit a single
 * `pct: 100` event before their final response.
 */
export const progressEnvelopeSchema = envelopeBase.extend({
  kind: z.literal('progress'),
  pct: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
});
export type ProgressEnvelope = z.infer<typeof progressEnvelopeSchema>;

/** Top-level union for everything that crosses the bridge.
 *  Not a discriminated union — the two response variants share `kind:'response'`
 *  and discriminate internally on `success`. */
export const bridgeEnvelopeSchema = z.union([
  toolRequestEnvelopeSchema,
  toolResponseEnvelopeSchema,
  discoveryRequestEnvelopeSchema,
  discoveryResponseEnvelopeSchema,
  progressEnvelopeSchema,
]);
export type BridgeEnvelope = z.infer<typeof bridgeEnvelopeSchema>;

/**
 * Generate a unique envelope id. Plain enough that the Node side can call it
 * too; collision-resistant enough that two halves of a session won't clash.
 */
export function newEnvelopeId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}
