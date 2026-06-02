import { z } from 'zod';
import { getSearchIndex, querySearch } from '@/search';
import type { ToolDefinition } from '../types';

const searchGlobalSchema = z.object({
  q: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
});

export const searchGlobal: ToolDefinition<typeof searchGlobalSchema, unknown> = {
  name: 'search.global',
  category: 'Search',
  description: 'Cross-entity fuzzy/prefix search across maps, items, mobs, NPCs, quests, skills.',
  inputSchema: searchGlobalSchema,
  execute: async (input, ctx) => {
    const status = await ctx.db.status();
    const c = status.counts;
    const epoch = [
      c.items,
      c.equips,
      c.mobs,
      c.npcs,
      c.maps,
      c.quests,
      c.questChains,
      c.skills,
    ].join(':');
    const idx = await getSearchIndex(epoch);
    return querySearch(idx, input.q, input.limit ?? 50);
  },
};

export const searchTools = [searchGlobal];
