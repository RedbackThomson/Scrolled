import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema, idsSchema, optionalIdSchema, listOptsBaseSchema } from './schemas';

const questsSearchSchema = listOptsBaseSchema.extend({
  parent: z.string().optional(),
});
export const questsSearch: ToolDefinition<typeof questsSearchSchema, unknown> = {
  name: 'quests.search',
  category: 'Quests',
  description: 'Search and page through quests, optionally filtered by parent.',
  inputSchema: questsSearchSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.listQuests(input),
};

const questsGetSchema = z.object({ id: idSchema });
export const questsGet: ToolDefinition<typeof questsGetSchema, unknown> = {
  name: 'quests.get',
  category: 'Quests',
  description: 'Fetch one quest by id.',
  inputSchema: questsGetSchema,
  annotations: READ,
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
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listQuestParents(),
};

const questsRequirementsSchema = z
  .object({ id: optionalIdSchema, ids: idsSchema.optional() })
  .refine((v) => v.id != null || v.ids != null, { message: 'Pass id or ids.' });
export const questsRequirements: ToolDefinition<typeof questsRequirementsSchema, unknown> = {
  name: 'quests.listRequirements',
  category: 'Quests',
  description:
    'Requirements joined to target names. Pass `id` for one quest or `ids` for many; the result is always a flat array with each row keyed by `questId`.',
  inputSchema: questsRequirementsSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getQuestRequirementsMany(input.ids ?? [input.id!]),
};

const questsRewardsSchema = z
  .object({ id: optionalIdSchema, ids: idsSchema.optional() })
  .refine((v) => v.id != null || v.ids != null, { message: 'Pass id or ids.' });
export const questsRewards: ToolDefinition<typeof questsRewardsSchema, unknown> = {
  name: 'quests.listRewards',
  category: 'Quests',
  description:
    'Rewards joined to target names. Pass `id` for one quest or `ids` for many; the result is always a flat array with each row keyed by `questId`.',
  inputSchema: questsRewardsSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getQuestRewardsMany(input.ids ?? [input.id!]),
};

const questsBundleSchema = z.object({ ids: idsSchema });
export const questsBundle: ToolDefinition<typeof questsBundleSchema, unknown> = {
  name: 'quests.bundle',
  category: 'Quests',
  description:
    'Fetch many quests with their requirements and rewards in one call, as [{ quest, requirements, rewards }].',
  inputSchema: questsBundleSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const [records, requirements, rewards] = await Promise.all([
      ctx.db.getQuestsMany(input.ids),
      ctx.db.getQuestRequirementsMany(input.ids),
      ctx.db.getQuestRewardsMany(input.ids),
    ]);
    const reqBy = groupByQuestId(requirements);
    const rewardBy = groupByQuestId(rewards);
    return records.map((quest) => ({
      quest,
      requirements: reqBy.get(quest.id) ?? [],
      rewards: rewardBy.get(quest.id) ?? [],
    }));
  },
};

function groupByQuestId<T extends { questId: number }>(rows: T[]): Map<number, T[]> {
  const by = new Map<number, T[]>();
  for (const row of rows) {
    const arr = by.get(row.questId);
    if (arr) arr.push(row);
    else by.set(row.questId, [row]);
  }
  return by;
}

export const questTools = [
  questsSearch,
  questsGet,
  questsParents,
  questsRequirements,
  questsRewards,
  questsBundle,
];
