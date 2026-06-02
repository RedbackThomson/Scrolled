import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema, listOptsBaseSchema } from './schemas';

const questsSearchSchema = listOptsBaseSchema.extend({
  parent: z.string().optional(),
});
export const questsSearch: ToolDefinition<typeof questsSearchSchema, unknown> = {
  name: 'quests.search',
  category: 'Quests',
  description: 'Search and page through quests, optionally filtered by parent.',
  inputSchema: questsSearchSchema,
  execute: (input, ctx) => ctx.db.listQuests(input),
};

const questsGetSchema = z.object({ id: idSchema });
export const questsGet: ToolDefinition<typeof questsGetSchema, unknown> = {
  name: 'quests.get',
  category: 'Quests',
  description: 'Fetch one quest by id.',
  inputSchema: questsGetSchema,
  execute: async (input, ctx) => {
    const row = await ctx.db.getQuest(input.id);
    if (!row) throw new NotFoundError(`Quest ${input.id} not found`);
    return row;
  },
};

const questsParentsSchema = z.object({}).optional();
export const questsParents: ToolDefinition<typeof questsParentsSchema, unknown> = {
  name: 'quests.listParents',
  category: 'Quests',
  description: 'Distinct quest parent values for filter UIs.',
  inputSchema: questsParentsSchema,
  execute: (_input, ctx) => ctx.db.listQuestParents(),
};

const questsRequirementsSchema = z.object({ id: idSchema });
export const questsRequirements: ToolDefinition<typeof questsRequirementsSchema, unknown> = {
  name: 'quests.listRequirements',
  category: 'Quests',
  description: 'Requirements for a quest, joined to target names.',
  inputSchema: questsRequirementsSchema,
  execute: (input, ctx) => ctx.db.getQuestRequirements(input.id),
};

const questsRewardsSchema = z.object({ id: idSchema });
export const questsRewards: ToolDefinition<typeof questsRewardsSchema, unknown> = {
  name: 'quests.listRewards',
  category: 'Quests',
  description: 'Rewards for a quest, joined to target names.',
  inputSchema: questsRewardsSchema,
  execute: (input, ctx) => ctx.db.getQuestRewards(input.id),
};

export const questTools = [
  questsSearch,
  questsGet,
  questsParents,
  questsRequirements,
  questsRewards,
];
