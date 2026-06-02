import { z } from 'zod';
import {
  EQUIP_STAT_KEYS,
  calculateEquipRanges,
  resolveServerProfile,
  type EquipBaseStats,
} from '@/serverProfiles';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema, listOptsBaseSchema } from './schemas';

const equipmentSearchSchema = listOptsBaseSchema.extend({
  slot: z.string().optional(),
  kind: z.enum(['equip', 'weapon']).optional(),
});
export const equipmentSearch: ToolDefinition<typeof equipmentSearchSchema, unknown> = {
  name: 'equipment.search',
  category: 'Equipment',
  description: 'Search and page through equips (armor + weapons).',
  inputSchema: equipmentSearchSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.db.listEquips(input),
};

const equipmentGetSchema = z.object({ id: idSchema });
export const equipmentGet: ToolDefinition<typeof equipmentGetSchema, unknown> = {
  name: 'equipment.get',
  category: 'Equipment',
  description: 'Fetch one equip by id.',
  inputSchema: equipmentGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getEquip(input.id);
    if (!row) throw new NotFoundError(`Equip ${input.id} not found`);
    return row;
  },
};

const equipmentSlotsSchema = z.object({}).optional();
export const equipmentSlots: ToolDefinition<typeof equipmentSlotsSchema, unknown> = {
  name: 'equipment.listSlots',
  category: 'Equipment',
  description: 'Distinct equip slot values for filters / nav.',
  inputSchema: equipmentSlotsSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listEquipSlots(),
};

const equipmentTypesSchema = z.object({}).optional();
export const equipmentTypes: ToolDefinition<typeof equipmentTypesSchema, unknown> = {
  name: 'equipment.listTypes',
  category: 'Equipment',
  description: 'Distinct weapon equip-type values for the Weapons nav.',
  inputSchema: equipmentTypesSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listEquipTypes(),
};

const equipmentRangesSchema = z.object({ id: idSchema });
export const equipmentRanges: ToolDefinition<typeof equipmentRangesSchema, unknown> = {
  name: 'equipment.ranges',
  category: 'Equipment',
  description:
    'Possible stat ranges for an equip under the currently active server profile.',
  inputSchema: equipmentRangesSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getEquip(input.id);
    if (!row) throw new NotFoundError(`Equip ${input.id} not found`);
    const profileId = await ctx.db.getServerProfile();
    const profile = resolveServerProfile(profileId);
    const stats: EquipBaseStats = EQUIP_STAT_KEYS.reduce((acc, key) => {
      acc[key] = (row as unknown as Record<string, number | null>)[key] ?? null;
      return acc;
    }, {} as EquipBaseStats);
    return calculateEquipRanges(profile, stats);
  },
};

export const equipmentTools = [
  equipmentSearch,
  equipmentGet,
  equipmentSlots,
  equipmentTypes,
  equipmentRanges,
];
