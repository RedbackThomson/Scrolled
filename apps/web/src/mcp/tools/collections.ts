import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { DESTRUCTIVE, READ, WRITE_IDEMPOTENT, WRITE_NEW } from './annotations';
import { idSchema, collectionEntityTypeSchema } from './schemas';

const collectionsListSchema = z.object({}).optional();
export const collectionsList: ToolDefinition<typeof collectionsListSchema, unknown> = {
  name: 'collections.list',
  category: 'Collections',
  description: 'List every collection with its member count.',
  inputSchema: collectionsListSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.userDb.listCollections(),
};

const collectionsGetSchema = z.object({ id: idSchema });
export const collectionsGet: ToolDefinition<typeof collectionsGetSchema, unknown> = {
  name: 'collections.get',
  category: 'Collections',
  description: 'Fetch one collection by id.',
  inputSchema: collectionsGetSchema,
  annotations: READ,
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
  annotations: WRITE_NEW,
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
  annotations: WRITE_IDEMPOTENT,
  execute: (input, ctx) => ctx.userDb.updateCollection(input.id, input.patch),
};

const collectionsDeleteSchema = z.object({ id: idSchema });
export const collectionsDelete: ToolDefinition<typeof collectionsDeleteSchema, unknown> = {
  name: 'collections.delete',
  category: 'Collections',
  description: 'Delete a collection and all its members.',
  inputSchema: collectionsDeleteSchema,
  annotations: DESTRUCTIVE,
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
  annotations: WRITE_IDEMPOTENT,
  execute: (input, ctx) => ctx.userDb.setCollectionPinned(input.id, input.pinned),
};

const collectionsAddEntitySchema = z.object({
  collectionId: idSchema,
  entityType: collectionEntityTypeSchema,
  entityId: idSchema,
  note: z.string().nullable().optional(),
  quantity: z.number().int().nullable().optional(),
  done: z.boolean().optional(),
  groupId: idSchema.nullable().optional(),
});
export const collectionsAddEntity: ToolDefinition<typeof collectionsAddEntitySchema, unknown> = {
  name: 'collections.addEntity',
  category: 'Collections',
  description:
    'Add an entity to a collection. Pass `groupId` to land it in a named group; omit or null for the default group. Idempotent — re-adds preserve existing group and position.',
  inputSchema: collectionsAddEntitySchema,
  annotations: WRITE_IDEMPOTENT,
  execute: async (input, ctx) => {
    await ctx.userDb.addMember(input.collectionId, input.entityType, input.entityId, {
      note: input.note ?? null,
      quantity: input.quantity ?? null,
      done: input.done,
      groupId: input.groupId ?? null,
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
  annotations: DESTRUCTIVE,
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
  annotations: READ,
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
  annotations: READ,
  execute: (input, ctx) => ctx.userDb.listMembershipsFor(input.entityType, input.entityId),
};

const collectionsBulkAddSchema = z
  .object({
    collectionId: idSchema,
    refs: z
      .array(
        z.object({
          entityType: collectionEntityTypeSchema,
          entityId: idSchema,
          quantity: z.number().int().nullable().optional(),
          note: z.string().nullable().optional(),
          done: z.boolean().optional(),
        }),
      )
      .min(1),
    groupId: idSchema.nullable().optional(),
    groupName: z.string().min(1).optional(),
  })
  .refine((v) => !(v.groupId != null && v.groupName != null), {
    message: 'Pass groupId or groupName, not both.',
  });
export const collectionsBulkAdd: ToolDefinition<typeof collectionsBulkAddSchema, unknown> = {
  name: 'collections.bulkAdd',
  category: 'Collections',
  description:
    'Add many entities to a collection in one transaction, each with optional quantity/note/done. Target a group by `groupId`, or by `groupName` (created if absent); omit both for the default group. Existing members are skipped without touching their metadata.',
  inputSchema: collectionsBulkAddSchema,
  annotations: WRITE_IDEMPOTENT,
  execute: async (input, ctx) => {
    let groupId = input.groupId ?? null;
    if (input.groupName != null) {
      const group = await ctx.userDb.ensureGroup(input.collectionId, input.groupName);
      groupId = group.id;
    }
    return ctx.userDb.bulkAddMembers(input.collectionId, input.refs, groupId);
  },
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
  annotations: DESTRUCTIVE,
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
