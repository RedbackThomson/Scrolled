import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema } from './schemas';

const chairsGetSchema = z.object({ id: idSchema });
export const chairsGet: ToolDefinition<typeof chairsGetSchema, unknown> = {
  name: 'chairs.get',
  category: 'Chairs',
  description: 'Fetch chair-specific metadata for an Install item id.',
  inputSchema: chairsGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getChair(input.id);
    if (!row) throw new NotFoundError(`Chair ${input.id} not found`);
    return row;
  },
};

export const chairTools = [chairsGet];
