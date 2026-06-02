import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema, listOptsBaseSchema } from './schemas';

const questChainsListSchema = listOptsBaseSchema.extend({
  parent: z.string().optional(),
});
export const questChainsList: ToolDefinition<typeof questChainsListSchema, unknown> = {
  name: 'questChains.list',
  category: 'QuestChains',
  description: 'Paged listing of derived quest chains.',
  inputSchema: questChainsListSchema,
  execute: (input, ctx) => ctx.db.listQuestChains(input),
};

const questChainsGetSchema = z.object({ id: idSchema });
export const questChainsGet: ToolDefinition<typeof questChainsGetSchema, unknown> = {
  name: 'questChains.get',
  category: 'QuestChains',
  description: 'Hydrated chain (members + edges) for the detail page.',
  inputSchema: questChainsGetSchema,
  execute: async (input, ctx) => {
    const row = await ctx.db.getQuestChain(input.id);
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
  execute: (input, ctx) => ctx.db.getChainForQuest(input.id),
};

export const questChainTools = [questChainsList, questChainsGet, questChainsForQuest];
