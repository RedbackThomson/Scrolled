import { z } from 'zod';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ } from './annotations';
import { idSchema } from './schemas';

const jobsListSchema = z.object({}).optional();
export const jobsList: ToolDefinition<typeof jobsListSchema, unknown> = {
  name: 'jobs.list',
  category: 'Jobs',
  description: 'Every job, ordered by id ascending.',
  inputSchema: jobsListSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.db.listJobs(),
};

const jobsGetSchema = z.object({ id: idSchema });
export const jobsGet: ToolDefinition<typeof jobsGetSchema, unknown> = {
  name: 'jobs.get',
  category: 'Jobs',
  description: 'Fetch one job by id.',
  inputSchema: jobsGetSchema,
  annotations: READ,
  execute: async (input, ctx) => {
    const row = await ctx.db.getJob(input.id);
    if (!row) throw new NotFoundError(`Job ${input.id} not found`);
    return row;
  },
};

export const jobTools = [jobsList, jobsGet];
