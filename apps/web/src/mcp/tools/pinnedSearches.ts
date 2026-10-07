import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { DESTRUCTIVE, READ, WRITE_IDEMPOTENT, WRITE_NEW } from './annotations';
import { SAVED_SEARCH_SCOPES } from '@/db/user';
import { idSchema } from './schemas';

const pinnedListSchema = z.object({}).optional();
export const pinnedList: ToolDefinition<typeof pinnedListSchema, unknown> = {
  name: 'pinnedSearches.list',
  category: 'PinnedSearches',
  description: "List the user's saved listing filters.",
  inputSchema: pinnedListSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.userDb.listPinnedSearches(),
};

const pinnedGetSchema = z.object({ id: idSchema });
export const pinnedGet: ToolDefinition<typeof pinnedGetSchema, unknown> = {
  name: 'pinnedSearches.get',
  category: 'PinnedSearches',
  description: 'Fetch one pinned search by id.',
  inputSchema: pinnedGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.userDb.getPinnedSearch(input.id);
    if (!row) throw new NotFoundError(`Pinned search ${input.id} not found`);
    return row;
  },
};

const iconSchema = z
  .string()
  .nullable()
  .describe('Icon key from the collections icon set; null for the default.');
const colorSchema = z
  .string()
  .nullable()
  .describe('Colour key from the collections colour set; null for the default.');

const pinnedCreateSchema = z.object({
  name: z.string().min(1),
  entity: z
    .enum(SAVED_SEARCH_SCOPES)
    .describe('The list page the search belongs to; "weapon" is the weapons page.'),
  params: z.record(z.string(), z.string()),
  icon: iconSchema.optional(),
  color: colorSchema.optional(),
  pinned: z.boolean().optional().describe('Show on the home page.'),
});
export const pinnedCreate: ToolDefinition<typeof pinnedCreateSchema, unknown> = {
  name: 'pinnedSearches.create',
  category: 'PinnedSearches',
  description: 'Save a new listing filter.',
  inputSchema: pinnedCreateSchema,
  annotations: WRITE_NEW,
  execute: (input, ctx) => ctx.userDb.createPinnedSearch(input),
};

const pinnedUpdateSchema = z.object({
  id: idSchema,
  patch: z.object({
    name: z.string().min(1).optional(),
    params: z.record(z.string(), z.string()).optional(),
    icon: iconSchema.optional(),
    color: colorSchema.optional(),
    pinned: z.boolean().optional(),
  }),
});
export const pinnedUpdate: ToolDefinition<typeof pinnedUpdateSchema, unknown> = {
  name: 'pinnedSearches.update',
  category: 'PinnedSearches',
  description: "Update a pinned search's name, params, icon, colour or home-page pin.",
  inputSchema: pinnedUpdateSchema,
  annotations: WRITE_IDEMPOTENT,
  execute: (input, ctx) => ctx.userDb.updatePinnedSearch(input.id, input.patch),
};

const pinnedReorderSchema = z.object({
  ids: z.array(idSchema).min(1).describe("One list page's saved searches in their new order."),
});
export const pinnedReorder: ToolDefinition<typeof pinnedReorderSchema, unknown> = {
  name: 'pinnedSearches.reorder',
  category: 'PinnedSearches',
  description: "Set the shelf order of a list page's saved searches.",
  inputSchema: pinnedReorderSchema,
  annotations: WRITE_IDEMPOTENT,
  execute: async (input, ctx) => {
    await ctx.userDb.reorderPinnedSearches(input.ids);
    return { ok: true };
  },
};

const pinnedDeleteSchema = z.object({ id: idSchema });
export const pinnedDelete: ToolDefinition<typeof pinnedDeleteSchema, unknown> = {
  name: 'pinnedSearches.delete',
  category: 'PinnedSearches',
  description: 'Delete a pinned search.',
  inputSchema: pinnedDeleteSchema,
  annotations: DESTRUCTIVE,
  execute: async (input, ctx) => {
    await ctx.userDb.deletePinnedSearch(input.id);
    return { ok: true };
  },
};

export const pinnedTools = [
  pinnedList,
  pinnedGet,
  pinnedCreate,
  pinnedUpdate,
  pinnedReorder,
  pinnedDelete,
];
