import { z } from 'zod';
import type { QueryClient } from '@tanstack/react-query';
import { getUserDbClient } from '@/db/user';
import { userSettingKey } from '@/hooks/useUserSetting';
import { ENTITY_KINDS } from '@/lib/entityRoutes';
import type { EntityKind } from '@/db';
import type { AnyTooltipEntityConfig, FieldMode } from './types';

export function tooltipSettingsKey(entity: EntityKind): string {
  return `tooltip.fields.${entity}`;
}

export const fieldModeSchema = z.enum(['always', 'never', 'whenPresent']);

/** Sparse overrides: only fields that differ from their default are stored, so
 *  unknown/removed keys parse cleanly and new fields inherit their default. */
export const fieldConfigSchema = z.record(z.string(), fieldModeSchema);

export type StoredFieldConfig = z.infer<typeof fieldConfigSchema>;

export const EMPTY_FIELD_CONFIG: StoredFieldConfig = Object.freeze({});

/** Merge stored overrides onto a config's per-field defaults. Overrides for
 *  keys the config no longer defines are ignored. */
export function resolveModes(
  config: AnyTooltipEntityConfig,
  overrides: StoredFieldConfig,
): Record<string, FieldMode> {
  const modes: Record<string, FieldMode> = {};
  for (const field of config.fields) {
    modes[field.key] = overrides[field.key] ?? field.defaultMode;
  }
  return modes;
}

/** Drop overrides equal to their default so the stored row stays sparse. */
export function pruneOverrides(
  config: AnyTooltipEntityConfig,
  overrides: StoredFieldConfig,
): StoredFieldConfig {
  const defaults = new Map(config.fields.map((f) => [f.key, f.defaultMode]));
  const pruned: StoredFieldConfig = {};
  for (const [key, mode] of Object.entries(overrides)) {
    if (defaults.has(key) && defaults.get(key) !== mode) pruned[key] = mode;
  }
  return pruned;
}

/** Clear every entity's tooltip customization at once. */
export async function resetAllTooltips(qc: QueryClient): Promise<void> {
  const db = getUserDbClient();
  await Promise.all(
    ENTITY_KINDS.map(async (entity) => {
      await db.deleteUserSetting(tooltipSettingsKey(entity));
      qc.setQueryData(userSettingKey(tooltipSettingsKey(entity)), EMPTY_FIELD_CONFIG);
    }),
  );
}
