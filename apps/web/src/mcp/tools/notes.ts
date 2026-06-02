import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { idSchema, collectionEntityTypeSchema } from './schemas';

const notesUpdateSchema = z.object({
  collectionId: idSchema,
  entityType: collectionEntityTypeSchema,
  entityId: idSchema,
  patch: z.object({
    note: z.string().nullable().optional(),
    quantity: z.number().int().nullable().optional(),
    done: z.boolean().optional(),
  }),
});
export const notesUpdate: ToolDefinition<typeof notesUpdateSchema, unknown> = {
  name: 'notes.update',
  category: 'Notes',
  description:
    'Update a collection member\'s note / target quantity / done flag. Any subset of the patch is fine.',
  inputSchema: notesUpdateSchema,
  execute: async (input, ctx) => {
    await ctx.userDb.updateMember(
      input.collectionId,
      input.entityType,
      input.entityId,
      input.patch,
    );
    return { ok: true };
  },
};

export const noteTools = [notesUpdate];
