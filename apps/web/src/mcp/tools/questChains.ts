import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema, idsSchema, optionalIdSchema, listOptsBaseSchema } from './schemas';

const questChainsListSchema = listOptsBaseSchema.extend({
  parent: z.string().optional(),
});
export const questChainsList: ToolDefinition<typeof questChainsListSchema, unknown> = {
  name: 'questChains.list',
  category: 'QuestChains',
  description: 'Paged listing of derived quest chains.',
  inputSchema: questChainsListSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.listQuestChains(input),
};

const questChainsGetSchema = z
  .object({ id: optionalIdSchema, ids: idsSchema.optional() })
  .refine((v) => v.id != null || v.ids != null, { message: 'Pass id or ids.' });
export const questChainsGet: ToolDefinition<typeof questChainsGetSchema, unknown> = {
  name: 'questChains.get',
  category: 'QuestChains',
  description:
    'Hydrated chains (members + edges). Pass `id` for one chain (returns the chain, or errors if missing) or `ids` for many (returns an array, missing ids omitted).',
  inputSchema: questChainsGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    if (input.ids) return ctx.db.getQuestChainsMany(input.ids);
    const row = await ctx.db.getQuestChain(input.id!);
    if (!row) throw new NotFoundError(`Quest chain ${input.id} not found`);
    return row;
  },
};

const questChainsForQuestSchema = z.object({ id: idSchema });
export const questChainsForQuest: ToolDefinition<typeof questChainsForQuestSchema, unknown> = {
  name: 'questChains.forQuest',
  category: 'QuestChains',
  description: 'Chain a given quest belongs to, or null.',
  inputSchema: questChainsForQuestSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getChainForQuest(input.id),
};

export const questChainTools = [questChainsList, questChainsGet, questChainsForQuest];
