import { z } from 'zod';
import type { ToolDefinition } from '../types';

const emptySchema = z.object({}).optional();

export const dbGameStatus: ToolDefinition<typeof emptySchema, unknown> = {
  name: 'db.gameStatus',
  category: 'Database',
  description: 'Game-data DB status (schema/data revision, counts, backend).',
  inputSchema: emptySchema,
  execute: (_input, ctx) => ctx.db.status(),
};

export const dbUserStatus: ToolDefinition<typeof emptySchema, unknown> = {
  name: 'db.userStatus',
  category: 'Database',
  description: 'User-data DB status (schema version, counts, backend).',
  inputSchema: emptySchema,
  execute: (_input, ctx) => ctx.userDb.status(),
};

export const dbTools = [dbGameStatus, dbUserStatus];
