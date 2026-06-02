import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema, listOptsBaseSchema } from './schemas';

export const monstersSearch: ToolDefinition<typeof listOptsBaseSchema, unknown> = {
  name: 'monsters.search',
  category: 'Monsters',
  description: 'Search and page through mobs.',
  inputSchema: listOptsBaseSchema,
  execute: (input, ctx) => ctx.db.listMobs(input),
};

const monstersGetSchema = z.object({ id: idSchema });
export const monstersGet: ToolDefinition<typeof monstersGetSchema, unknown> = {
  name: 'monsters.get',
  category: 'Monsters',
  description: 'Fetch one mob by id.',
  inputSchema: monstersGetSchema,
  execute: async (input, ctx) => {
    const row = await ctx.db.getMob(input.id);
    if (!row) throw new NotFoundError(`Mob ${input.id} not found`);
    return row;
  },
};

const monstersDropsSchema = z.object({ id: idSchema });
export const monstersDrops: ToolDefinition<typeof monstersDropsSchema, unknown> = {
  name: 'monsters.listDrops',
  category: 'Monsters',
  description: 'Items this mob can drop, joined to item / equip names.',
  inputSchema: monstersDropsSchema,
  execute: (input, ctx) => ctx.db.getMobDrops(input.id),
};

const monstersMapsSchema = z.object({ id: idSchema });
export const monstersMaps: ToolDefinition<typeof monstersMapsSchema, unknown> = {
  name: 'monsters.listMaps',
  category: 'Monsters',
  description: 'Maps where this mob spawns, with per-map aggregated count.',
  inputSchema: monstersMapsSchema,
  execute: (input, ctx) => ctx.db.getMobMaps(input.id),
};

const monstersQuestsSchema = z.object({ id: idSchema });
export const monstersQuests: ToolDefinition<typeof monstersQuestsSchema, unknown> = {
  name: 'monsters.listQuests',
  category: 'Monsters',
  description: 'Quests that require killing this mob.',
  inputSchema: monstersQuestsSchema,
  execute: (input, ctx) => ctx.db.getMobQuests(input.id),
};

export const monsterTools = [
  monstersSearch,
  monstersGet,
  monstersDrops,
  monstersMaps,
  monstersQuests,
];
