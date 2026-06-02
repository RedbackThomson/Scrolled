import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema, collectionEntityTypeSchema } from './schemas';

const collectionsListSchema = z.object({}).optional();
export const collectionsList: ToolDefinition<typeof collectionsListSchema, unknown> = {
  name: 'collections.list',
  category: 'Collections',
  description: 'List every collection with its member count.',
  inputSchema: collectionsListSchema,
  execute: (_input, ctx) => ctx.userDb.listCollections(),
};

const collectionsGetSchema = z.object({ id: idSchema });
export const collectionsGet: ToolDefinition<typeof collectionsGetSchema, unknown> = {
  name: 'collections.get',
  category: 'Collections',
  description: 'Fetch one collection by id.',
  inputSchema: collectionsGetSchema,
  execute: async (input, ctx) => {
    const row = await ctx.userDb.getCollection(input.id);
    if (!row) throw new NotFoundError(`Collection ${input.id} not found`);
    return row;
  },
};

const collectionsCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});
export const collectionsCreate: ToolDefinition<typeof collectionsCreateSchema, unknown> = {
  name: 'collections.create',
  category: 'Collections',
  description: 'Create a new collection.',
  inputSchema: collectionsCreateSchema,
  execute: (input, ctx) => ctx.userDb.createCollection(input),
};

const collectionsUpdateSchema = z.object({
  id: idSchema,
  patch: z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    grouping: z.enum(['none', 'group', 'type']).optional(),
    subgrouping: z.enum(['none', 'group', 'type']).optional(),
    sortKey: z.enum(['manual', 'name', 'added', 'done', 'quantity']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  }),
});
export const collectionsUpdate: ToolDefinition<typeof collectionsUpdateSchema, unknown> = {
  name: 'collections.update',
  category: 'Collections',
  description: 'Update a collection — any subset of its mutable fields.',
  inputSchema: collectionsUpdateSchema,
  execute: (input, ctx) => ctx.userDb.updateCollection(input.id, input.patch),
};

const collectionsDeleteSchema = z.object({ id: idSchema });
export const collectionsDelete: ToolDefinition<typeof collectionsDeleteSchema, unknown> = {
  name: 'collections.delete',
  category: 'Collections',
  description: 'Delete a collection and all its members.',
  inputSchema: collectionsDeleteSchema,
  execute: async (input, ctx) => {
    await ctx.userDb.deleteCollection(input.id);
    return { ok: true };
  },
};

const collectionsSetPinnedSchema = z.object({
  id: idSchema,
  pinned: z.boolean(),
});
export const collectionsSetPinned: ToolDefinition<typeof collectionsSetPinnedSchema, unknown> = {
  name: 'collections.setPinned',
  category: 'Collections',
  description: 'Pin or unpin a collection on the home page.',
  inputSchema: collectionsSetPinnedSchema,
  execute: (input, ctx) => ctx.userDb.setCollectionPinned(input.id, input.pinned),
};

const collectionsAddEntitySchema = z.object({
  collectionId: idSchema,
  entityType: collectionEntityTypeSchema,
  entityId: idSchema,
  note: z.string().nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  done: z.boolean().optional(),
});
export const collectionsAddEntity: ToolDefinition<typeof collectionsAddEntitySchema, unknown> = {
  name: 'collections.addEntity',
  category: 'Collections',
  description: 'Add an entity to a collection. Idempotent — re-adds are a no-op.',
  inputSchema: collectionsAddEntitySchema,
  execute: async (input, ctx) => {
    await ctx.userDb.addMember(input.collectionId, input.entityType, input.entityId, {
      note: input.note ?? null,
      quantity: input.quantity ?? null,
      done: input.done,
    });
    return { ok: true };
  },
};

const collectionsRemoveEntitySchema = z.object({
  collectionId: idSchema,
  entityType: collectionEntityTypeSchema,
  entityId: idSchema,
});
export const collectionsRemoveEntity: ToolDefinition<
  typeof collectionsRemoveEntitySchema,
  unknown
> = {
  name: 'collections.removeEntity',
  category: 'Collections',
  description: 'Remove an entity from a collection.',
  inputSchema: collectionsRemoveEntitySchema,
  execute: async (input, ctx) => {
    await ctx.userDb.removeMember(input.collectionId, input.entityType, input.entityId);
    return { ok: true };
  },
};

const collectionsListMembersSchema = z.object({ id: idSchema });
export const collectionsListMembers: ToolDefinition<
  typeof collectionsListMembersSchema,
  unknown
> = {
  name: 'collections.listMembers',
  category: 'Collections',
  description: 'List members of a collection.',
  inputSchema: collectionsListMembersSchema,
  execute: (input, ctx) => ctx.userDb.listMembers(input.id),
};

const collectionsListMembershipsSchema = z.object({
  entityType: collectionEntityTypeSchema,
  entityId: idSchema,
});
export const collectionsListMemberships: ToolDefinition<
  typeof collectionsListMembershipsSchema,
  unknown
> = {
  name: 'collections.listMemberships',
  category: 'Collections',
  description: 'Collections that contain the given (entityType, entityId).',
  inputSchema: collectionsListMembershipsSchema,
  execute: (input, ctx) => ctx.userDb.listMembershipsFor(input.entityType, input.entityId),
};

const collectionsBulkAddSchema = z.object({
  collectionId: idSchema,
  refs: z.array(z.object({ entityType: collectionEntityTypeSchema, entityId: idSchema })).min(1),
});
export const collectionsBulkAdd: ToolDefinition<typeof collectionsBulkAddSchema, unknown> = {
  name: 'collections.bulkAdd',
  category: 'Collections',
  description: 'Add many entities to a collection in one transaction.',
  inputSchema: collectionsBulkAddSchema,
  execute: (input, ctx) => ctx.userDb.bulkAddMembers(input.collectionId, input.refs),
};

const collectionsBulkRemoveSchema = z.object({
  collectionId: idSchema,
  refs: z.array(z.object({ entityType: collectionEntityTypeSchema, entityId: idSchema })).min(1),
});
export const collectionsBulkRemove: ToolDefinition<typeof collectionsBulkRemoveSchema, unknown> = {
  name: 'collections.bulkRemove',
  category: 'Collections',
  description: 'Remove many entities from a collection in one transaction.',
  inputSchema: collectionsBulkRemoveSchema,
  execute: async (input, ctx) => {
    await ctx.userDb.bulkRemoveMembers(input.collectionId, input.refs);
    return { ok: true };
  },
};

export const collectionTools = [
  collectionsList,
  collectionsGet,
  collectionsCreate,
  collectionsUpdate,
  collectionsDelete,
  collectionsSetPinned,
  collectionsAddEntity,
  collectionsRemoveEntity,
  collectionsListMembers,
  collectionsListMemberships,
  collectionsBulkAdd,
  collectionsBulkRemove,
];
