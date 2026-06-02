import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { idSchema, collectionEntityTypeSchema } from './schemas';

const groupsListSchema = z.object({ collectionId: idSchema });
export const groupsList: ToolDefinition<typeof groupsListSchema, unknown> = {
  name: 'collectionGroups.list',
  category: 'Groups',
  description: 'List user-defined groups inside a collection (default group is implicit).',
  inputSchema: groupsListSchema,
  execute: (input, ctx) => ctx.userDb.listGroups(input.collectionId),
};

const groupsCreateSchema = z.object({
  collectionId: idSchema,
  name: z.string().min(1),
});
export const groupsCreate: ToolDefinition<typeof groupsCreateSchema, unknown> = {
  name: 'collectionGroups.create',
  category: 'Groups',
  description: 'Create a new group inside a collection.',
  inputSchema: groupsCreateSchema,
  execute: (input, ctx) => ctx.userDb.createGroup(input.collectionId, input.name),
};

const groupsRenameSchema = z.object({ groupId: idSchema, name: z.string().min(1) });
export const groupsRename: ToolDefinition<typeof groupsRenameSchema, unknown> = {
  name: 'collectionGroups.rename',
  category: 'Groups',
  description: 'Rename a group.',
  inputSchema: groupsRenameSchema,
  execute: (input, ctx) => ctx.userDb.renameGroup(input.groupId, input.name),
};

const groupsDeleteSchema = z.object({ groupId: idSchema });
export const groupsDelete: ToolDefinition<typeof groupsDeleteSchema, unknown> = {
  name: 'collectionGroups.delete',
  category: 'Groups',
  description: 'Delete a group. Members fall back into the implicit default group.',
  inputSchema: groupsDeleteSchema,
  execute: async (input, ctx) => {
    await ctx.userDb.deleteGroup(input.groupId);
    return { ok: true };
  },
};

const groupsReorderSchema = z.object({
  collectionId: idSchema,
  orderedGroupIds: z.array(idSchema).min(1),
});
export const groupsReorder: ToolDefinition<typeof groupsReorderSchema, unknown> = {
  name: 'collectionGroups.reorder',
  category: 'Groups',
  description: 'Persist a new top-to-bottom ordering of a collection\'s groups.',
  inputSchema: groupsReorderSchema,
  execute: async (input, ctx) => {
    await ctx.userDb.reorderGroups(input.collectionId, input.orderedGroupIds);
    return { ok: true };
  },
};

const groupsMoveMemberSchema = z.object({
  collectionId: idSchema,
  entityType: collectionEntityTypeSchema,
  entityId: idSchema,
  targetGroupId: idSchema.nullable(),
  targetIndex: z.number().int().min(0),
});
export const groupsMoveMember: ToolDefinition<typeof groupsMoveMemberSchema, unknown> = {
  name: 'collectionGroups.moveMember',
  category: 'Groups',
  description:
    'Move a member to a (groupId|null, index). `null` group means the implicit default group.',
  inputSchema: groupsMoveMemberSchema,
  execute: async (input, ctx) => {
    await ctx.userDb.moveMember(
      input.collectionId,
      input.entityType,
      input.entityId,
      input.targetGroupId,
      input.targetIndex,
    );
    return { ok: true };
  },
};

export const groupTools = [
  groupsList,
  groupsCreate,
  groupsRename,
  groupsDelete,
  groupsReorder,
  groupsMoveMember,
];
