// Runtime mirror of `./types.ts` for validation. compileGraph parses through
// these at load time, and the export CLI re-parses on round-trip. Branded ids
// are plain strings on the wire — branding is a TypeScript-only convenience.

import { z } from 'zod';
import type { GroupId, NodeId, Requirement } from './types';
import { TRAVEL_METHODS } from './types';

const nodeIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'NodeId must be kebab-case (a-z, 0-9, hyphen)')
  .transform((s) => s as NodeId);

const groupIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'GroupId must be kebab-case (a-z, 0-9, hyphen)')
  .transform((s) => s as GroupId);

const travelMethodSchema = z.enum(TRAVEL_METHODS);

const requirementSchema: z.ZodType<Requirement> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('meso'), amount: z.number().int().nonnegative() }),
  z.object({
    kind: z.literal('item'),
    itemId: z.number().int().positive(),
    consumed: z.boolean(),
    quantity: z.number().int().positive().optional(),
  }),
  z.object({ kind: z.literal('quest'), questId: z.number().int().positive() }),
  z.object({ kind: z.literal('level'), min: z.number().int().min(1).max(300) }),
]);

const entityRefsSchema = z.object({
  itemId: z.number().int().positive().optional(),
  questId: z.number().int().positive().optional(),
  npcId: z.number().int().positive().optional(),
});

const areaNodeSchema = z.object({
  id: nodeIdSchema,
  name: z.string().min(1),
  group: groupIdSchema.optional(),
});

const travelEdgeSchema = z
  .object({
    from: nodeIdSchema,
    to: nodeIdSchema,
    bidirectional: z.boolean().optional(),
    method: travelMethodSchema,
    via: z.string().optional(),
    refs: entityRefsSchema.optional(),
    requirements: z.array(requirementSchema).optional(),
    seconds: z.number().positive().optional(),
    notes: z.string().optional(),
  })
  .superRefine((edge, ctx) => {
    if (edge.seconds !== undefined && edge.method !== 'walk') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['seconds'],
        message: `seconds is only valid on walk edges; "${edge.method}" transitions are instant.`,
      });
    }
  });

const groupDefSchema = z.object({
  id: groupIdSchema,
  name: z.string().min(1),
});

export const navGraphSourceSchema = z.object({
  profileId: z.string().min(1),
  nodes: z.array(areaNodeSchema),
  edges: z.array(travelEdgeSchema),
  groups: z.array(groupDefSchema).optional(),
});

export {
  areaNodeSchema,
  entityRefsSchema,
  groupDefSchema,
  groupIdSchema,
  nodeIdSchema,
  requirementSchema,
  travelEdgeSchema,
  travelMethodSchema,
};
