import { z } from 'zod';
import { getSearchIndex, querySearch, type SearchHit } from '@/search';
import type { QuestSummary } from '@scrolled/game-db/db/types';
import type { ToolContext, ToolDefinition } from '../types';
import { READ } from './annotations';

const searchGlobalSchema = z.object({
  q: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional(),
  includeQuests: z.boolean().optional(),
});

export const searchGlobal: ToolDefinition<typeof searchGlobalSchema, unknown> = {
  name: 'search.global',
  category: 'Search',
  description:
    'Cross-entity fuzzy/prefix search across maps, items, mobs, NPCs, quests, skills. Pass `includeQuests` to also attach, to each item/mob/NPC hit, the quests that reference it — resolving a guide label to a quest in one call.',
  inputSchema: searchGlobalSchema,
  annotations: READ,
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
    const hits = querySearch(idx, input.q, input.limit ?? 50);
    if (!input.includeQuests) return hits;
    return Promise.all(
      hits.map(async (hit) => {
        const quests = await attachedQuests(ctx, hit);
        return quests ? { ...hit, attachedQuests: quests } : hit;
      }),
    );
  },
};

function attachedQuests(ctx: ToolContext, hit: SearchHit): Promise<QuestSummary[]> | null {
  switch (hit.entity) {
    case 'item':
    case 'equip':
      return ctx.db.getItemQuests(hit.id);
    case 'mob':
      return ctx.db.getMobQuests(hit.id);
    case 'npc':
      return ctx.db.getNpcQuests(hit.id);
    default:
      return null;
  }
}

export const searchTools = [searchGlobal];
