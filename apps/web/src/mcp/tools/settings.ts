import { z } from 'zod';
import type { ToolDefinition } from '../types';
import { DESTRUCTIVE, READ, WRITE_IDEMPOTENT } from './annotations';

const getUserSettingSchema = z.object({ key: z.string().min(1) });
export const settingsGetUserSetting: ToolDefinition<typeof getUserSettingSchema, unknown> = {
  name: 'settings.getUserSetting',
  category: 'Settings',
  description:
    'Read a raw `user_settings` row. The `value` field is an opaque JSON string the caller is expected to parse.',
  inputSchema: getUserSettingSchema,
  annotations: READ,
  execute: (input, ctx) => ctx.userDb.getUserSetting(input.key),
};

const setUserSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
export const settingsSetUserSetting: ToolDefinition<typeof setUserSettingSchema, unknown> = {
  name: 'settings.setUserSetting',
  category: 'Settings',
  description: 'Write a user setting. `value` is the consumer-serialized JSON string.',
  inputSchema: setUserSettingSchema,
  annotations: WRITE_IDEMPOTENT,
  execute: (input, ctx) => ctx.userDb.setUserSetting(input.key, input.value),
};

const listUserSettingsSchema = z.object({}).optional();
export const settingsListUserSettings: ToolDefinition<typeof listUserSettingsSchema, unknown> = {
  name: 'settings.listUserSettings',
  category: 'Settings',
  description: 'List every `user_settings` row.',
  inputSchema: listUserSettingsSchema,
  annotations: READ,
  execute: (_input, ctx) => ctx.userDb.listUserSettings(),
};

const deleteUserSettingSchema = z.object({ key: z.string().min(1) });
export const settingsDeleteUserSetting: ToolDefinition<typeof deleteUserSettingSchema, unknown> = {
  name: 'settings.deleteUserSetting',
  category: 'Settings',
  description: 'Delete a user setting row.',
  inputSchema: deleteUserSettingSchema,
  annotations: DESTRUCTIVE,
  execute: async (input, ctx) => {
    await ctx.userDb.deleteUserSetting(input.key);
    return { ok: true };
  },
};

export const settingsTools = [
  settingsGetUserSetting,
  settingsSetUserSetting,
  settingsListUserSettings,
  settingsDeleteUserSetting,
];
