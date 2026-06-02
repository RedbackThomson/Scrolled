import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { DESTRUCTIVE, READ, WRITE_IDEMPOTENT } from './annotations';

const getUiPrefSchema = z.object({ key: z.string().min(1) });
export const settingsGetUiPref: ToolDefinition<typeof getUiPrefSchema, unknown> = {
  name: 'settings.getUiPref',
  category: 'Settings',
  description:
    'Read a raw `ui_prefs` row. The `value` field is an opaque JSON string the caller is expected to parse.',
  inputSchema: getUiPrefSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.userDb.getUiPref(input.key),
};

const setUiPrefSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export const settingsSetUiPref: ToolDefinition<typeof setUiPrefSchema, unknown> = {
  name: 'settings.setUiPref',
  category: 'Settings',
  description: 'Write a UI preference. `value` is the consumer-serialized JSON string.',
  inputSchema: setUiPrefSchema,
  annotations: WRITE_IDEMPOTENT,
  execute: (input, ctx) => ctx.userDb.setUiPref(input.key, input.value),
};

const listUiPrefsSchema = z.object({}).optional();
export const settingsListUiPrefs: ToolDefinition<typeof listUiPrefsSchema, unknown> = {
  name: 'settings.listUiPrefs',
  category: 'Settings',
  description: 'List every `ui_prefs` row.',
  inputSchema: listUiPrefsSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.userDb.listUiPrefs(),
};

const deleteUiPrefSchema = z.object({ key: z.string().min(1) });
export const settingsDeleteUiPref: ToolDefinition<typeof deleteUiPrefSchema, unknown> = {
  name: 'settings.deleteUiPref',
  category: 'Settings',
  description: 'Delete a UI preference row.',
  inputSchema: deleteUiPrefSchema,
  annotations: DESTRUCTIVE,
  execute: async (input, ctx) => {
    await ctx.userDb.deleteUiPref(input.key);
    return { ok: true };
  },
};

export const settingsTools = [
  settingsGetUiPref,
  settingsSetUiPref,
  settingsListUiPrefs,
  settingsDeleteUiPref,
];
