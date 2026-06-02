import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { idSchema, listOptsBaseSchema } from './schemas';

export const mapsSearch: ToolDefinition<typeof listOptsBaseSchema, unknown> = {
  name: 'maps.search',
  category: 'Maps',
  description: 'Search and page through maps. Returns rows + total count.',
  inputSchema: listOptsBaseSchema,
  execute: (input, ctx) => ctx.db.listMaps(input),
};

const mapsGetSchema = z.object({ id: idSchema });
export const mapsGet: ToolDefinition<typeof mapsGetSchema, unknown> = {
  name: 'maps.get',
  category: 'Maps',
  description: 'Fetch one map by id, including minimap metadata.',
  inputSchema: mapsGetSchema,
  execute: async (input, ctx) => {
    const row = await ctx.db.getMap(input.id);
    if (!row) throw new NotFoundError(`Map ${input.id} not found`);
    return row;
  },
};

const mapsListMobsSchema = z.object({ id: idSchema });
export const mapsListMobs: ToolDefinition<typeof mapsListMobsSchema, unknown> = {
  name: 'maps.listMobs',
  category: 'Maps',
  description: 'List mobs that spawn on a given map, joined to mob names.',
  inputSchema: mapsListMobsSchema,
  execute: (input, ctx) => ctx.db.getMapMobs(input.id),
};

const mapsListNpcsSchema = z.object({ id: idSchema });
export const mapsListNpcs: ToolDefinition<typeof mapsListNpcsSchema, unknown> = {
  name: 'maps.listNpcs',
  category: 'Maps',
  description: 'List NPCs on a given map, joined to NPC names.',
  inputSchema: mapsListNpcsSchema,
  execute: (input, ctx) => ctx.db.getMapNpcs(input.id),
};

const mapsListPortalsSchema = z.object({ id: idSchema });
export const mapsListPortals: ToolDefinition<typeof mapsListPortalsSchema, unknown> = {
  name: 'maps.listPortals',
  category: 'Maps',
  description: 'List portals on a given map, joined to target map names.',
  inputSchema: mapsListPortalsSchema,
  execute: (input, ctx) => ctx.db.getMapPortals(input.id),
};

const mapsListMobSpawnsSchema = z.object({ id: idSchema });
export const mapsListMobSpawns: ToolDefinition<typeof mapsListMobSpawnsSchema, unknown> = {
  name: 'maps.listMobSpawns',
  category: 'Maps',
  description: 'List per-position mob spawns on a given map.',
  inputSchema: mapsListMobSpawnsSchema,
  execute: (input, ctx) => ctx.db.getMapMobSpawns(input.id),
};

export const mapTools = [
  mapsSearch,
  mapsGet,
  mapsListMobs,
  mapsListNpcs,
  mapsListPortals,
  mapsListMobSpawns,
];
