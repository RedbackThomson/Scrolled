import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema, listOptsBaseSchema } from './schemas';

const itemsSearchSchema = listOptsBaseSchema.extend({
  category: z.string().optional(),
});
export const itemsSearch: ToolDefinition<typeof itemsSearchSchema, unknown> = {
  name: 'items.search',
  category: 'Items',
  description: 'Search and page through use/setup/etc items.',
  inputSchema: itemsSearchSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.listItems(input),
};

const itemsGetSchema = z.object({ id: idSchema });
export const itemsGet: ToolDefinition<typeof itemsGetSchema, unknown> = {
  name: 'items.get',
  category: 'Items',
  description: 'Fetch one item by id.',
  inputSchema: itemsGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getItem(input.id);
    if (!row) throw new NotFoundError(`Item ${input.id} not found`);
    return row;
  },
};

const itemsCategoriesSchema = z.object({}).optional();
export const itemsCategories: ToolDefinition<typeof itemsCategoriesSchema, unknown> = {
  name: 'items.listCategories',
  category: 'Items',
  description: 'Distinct item category values for filters / nav.',
  inputSchema: itemsCategoriesSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listItemCategories(),
};

const itemsDroppedBySchema = z.object({ id: idSchema });
export const itemsDroppedBy: ToolDefinition<typeof itemsDroppedBySchema, unknown> = {
  name: 'items.listDroppedBy',
  category: 'Items',
  description: 'Mobs that can drop this item, joined to mob name + level.',
  inputSchema: itemsDroppedBySchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getItemDroppedBy(input.id),
};

const itemsQuestsRequiringSchema = z.object({ id: idSchema });
export const itemsQuestsRequiring: ToolDefinition<typeof itemsQuestsRequiringSchema, unknown> = {
  name: 'items.listQuestsRequiring',
  category: 'Items',
  description: 'Quests that ask for this item as a requirement.',
  inputSchema: itemsQuestsRequiringSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getItemQuests(input.id),
};

const itemsQuestsRewardingSchema = z.object({ id: idSchema });
export const itemsQuestsRewarding: ToolDefinition<typeof itemsQuestsRewardingSchema, unknown> = {
  name: 'items.listQuestsRewarding',
  category: 'Items',
  description: 'Quests that grant this item as a reward.',
  inputSchema: itemsQuestsRewardingSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getItemRewardingQuests(input.id),
};

export const itemTools = [
  itemsSearch,
  itemsGet,
  itemsCategories,
  itemsDroppedBy,
  itemsQuestsRequiring,
  itemsQuestsRewarding,
];
