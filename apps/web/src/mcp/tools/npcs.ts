import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema, listOptsBaseSchema } from './schemas';

export const npcsSearch: ToolDefinition<typeof listOptsBaseSchema, unknown> = {
  name: 'npcs.search',
  category: 'NPCs',
  description: 'Search and page through NPCs.',
  inputSchema: listOptsBaseSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.listNpcs(input),
};

const npcsGetSchema = z.object({ id: idSchema });
export const npcsGet: ToolDefinition<typeof npcsGetSchema, unknown> = {
  name: 'npcs.get',
  category: 'NPCs',
  description: 'Fetch one NPC by id.',
  inputSchema: npcsGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getNpc(input.id);
    if (!row) throw new NotFoundError(`NPC ${input.id} not found`);
    return row;
  },
};

const npcsMapsSchema = z.object({ id: idSchema });
export const npcsMaps: ToolDefinition<typeof npcsMapsSchema, unknown> = {
  name: 'npcs.listMaps',
  category: 'NPCs',
  description: 'Maps where this NPC appears.',
  inputSchema: npcsMapsSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getNpcMaps(input.id),
};

const npcsQuestsSchema = z.object({ id: idSchema });
export const npcsQuests: ToolDefinition<typeof npcsQuestsSchema, unknown> = {
  name: 'npcs.listQuests',
  category: 'NPCs',
  description: 'Quests this NPC offers (start or end).',
  inputSchema: npcsQuestsSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.getNpcQuests(input.id),
};

export const npcTools = [npcsSearch, npcsGet, npcsMaps, npcsQuests];
