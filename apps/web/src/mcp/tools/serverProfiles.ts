import { z } from 'zod';
import { BUILTIN_PROFILES, resolveServerProfile } from '@scrolled/game-db/serverProfiles';
import { NotFoundError } from '../errors';
import type { ToolDefinition } from '../types';
import { READ, WRITE_IDEMPOTENT } from './annotations';

const profilesListSchema = z.object({}).optional();
export const profilesList: ToolDefinition<typeof profilesListSchema, unknown> = {
  name: 'serverProfiles.list',
  category: 'ServerProfiles',
  description: 'List built-in server profiles.',
  inputSchema: profilesListSchema,
  annotations: READ,
  execute: async () => BUILTIN_PROFILES,
};

const profilesGetSchema = z.object({ id: z.string().min(1) });
export const profilesGet: ToolDefinition<typeof profilesGetSchema, unknown> = {
  name: 'serverProfiles.get',
  category: 'ServerProfiles',
  description: 'Fetch one server profile by id.',
  inputSchema: profilesGetSchema,
  annotations: READ,
  execute: async (input) => {
    const found = BUILTIN_PROFILES.find((p) => p.id === input.id);
    if (!found) throw new NotFoundError(`Server profile ${input.id} not found`);
    return found;
  },
};

const profilesGetActiveSchema = z.object({}).optional();
export const profilesGetActive: ToolDefinition<typeof profilesGetActiveSchema, unknown> = {
  name: 'serverProfiles.getActive',
  category: 'ServerProfiles',
  description: 'Currently active server profile.',
  inputSchema: profilesGetActiveSchema,
  annotations: READ,
  execute: async (_input, ctx) => {
    const id = await ctx.db.getServerProfile();
    return resolveServerProfile(id);
  },
};

const profilesSetActiveSchema = z.object({ id: z.string().min(1) });
export const profilesSetActive: ToolDefinition<typeof profilesSetActiveSchema, unknown> = {
  name: 'serverProfiles.setActive',
  category: 'ServerProfiles',
  description: 'Set the active server profile by id.',
  inputSchema: profilesSetActiveSchema,
  annotations: WRITE_IDEMPOTENT,
  execute: async (input, ctx) => {
    await ctx.db.setServerProfile(input.id);
    return { ok: true };
  },
};

export const serverProfileTools = [
  profilesList,
  profilesGet,
  profilesGetActive,
  profilesSetActive,
];
