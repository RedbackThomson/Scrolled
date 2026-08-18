// Shared input-schema fragments. Every list-style tool composes these on top
// of its own filters so input shapes stay uniform across categories.

import { z } from 'zod';

export const idSchema = z.number().int().nonnegative();
export const optionalIdSchema = idSchema.optional();
export const idsSchema = z.array(idSchema).min(1);

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const orderingSchema = z.object({
  orderBy: z.string().optional(),
  dir: z.enum(['asc', 'desc']).optional(),
});

/** Per-column filters mirror `ColumnFilter` from the DB layer. */
export const columnFilterSchema = z.union([
  z.object({
    kind: z.literal('string'),
    mode: z.enum(['contains', 'prefix', 'suffix', 'equals']),
    value: z.string(),
  }),
  z.object({
    kind: z.literal('enum'),
    values: z.array(z.string()).min(1),
  }),
  z.object({
    kind: z.literal('range'),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
]);

export const filtersSchema = z.record(z.string(), columnFilterSchema);

export const listOptsBaseSchema = paginationSchema.merge(orderingSchema).extend({
  search: z.string().optional(),
  filters: filtersSchema.optional(),
});

export const entityKindSchema = z.enum([
  'item',
  'equip',
  'mob',
  'npc',
  'map',
  'quest',
  'questChain',
  'skill',
]);

export const collectionEntityTypeSchema = entityKindSchema;
