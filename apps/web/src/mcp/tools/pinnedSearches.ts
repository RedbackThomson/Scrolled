import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema, collectionEntityTypeSchema } from './schemas';

const pinnedListSchema = z.object({}).optional();
export const pinnedList: ToolDefinition<typeof pinnedListSchema, unknown> = {
  name: 'pinnedSearches.list',
  category: 'PinnedSearches',
  description: 'List the user\'s saved listing filters.',
  inputSchema: pinnedListSchema,
  execute: (_input, ctx) => ctx.userDb.listPinnedSearches(),
};

const pinnedGetSchema = z.object({ id: idSchema });
export const pinnedGet: ToolDefinition<typeof pinnedGetSchema, unknown> = {
  name: 'pinnedSearches.get',
  category: 'PinnedSearches',
  description: 'Fetch one pinned search by id.',
  inputSchema: pinnedGetSchema,
  execute: async (input, ctx) => {
    const row = await ctx.userDb.getPinnedSearch(input.id);
    if (!row) throw new NotFoundError(`Pinned search ${input.id} not found`);
    return row;
  },
};

const pinnedCreateSchema = z.object({
  name: z.string().min(1),
  entity: collectionEntityTypeSchema,
  params: z.record(z.string(), z.string()),
});
export const pinnedCreate: ToolDefinition<typeof pinnedCreateSchema, unknown> = {
  name: 'pinnedSearches.create',
  category: 'PinnedSearches',
  description: 'Save a new listing filter.',
  inputSchema: pinnedCreateSchema,
  execute: (input, ctx) => ctx.userDb.createPinnedSearch(input),
};

const pinnedUpdateSchema = z.object({
  id: idSchema,
  patch: z.object({
    name: z.string().min(1).optional(),
    params: z.record(z.string(), z.string()).optional(),
  }),
});
export const pinnedUpdate: ToolDefinition<typeof pinnedUpdateSchema, unknown> = {
  name: 'pinnedSearches.update',
  category: 'PinnedSearches',
  description: 'Update a pinned search\'s name or params.',
  inputSchema: pinnedUpdateSchema,
  execute: (input, ctx) => ctx.userDb.updatePinnedSearch(input.id, input.patch),
};

const pinnedDeleteSchema = z.object({ id: idSchema });
export const pinnedDelete: ToolDefinition<typeof pinnedDeleteSchema, unknown> = {
  name: 'pinnedSearches.delete',
  category: 'PinnedSearches',
  description: 'Delete a pinned search.',
  inputSchema: pinnedDeleteSchema,
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
  pinnedDelete,
];
