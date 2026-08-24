import { useUserSetting } from '@/hooks/useUserSetting';
import type { EntityKind } from '@/db';
import { EMPTY_FIELD_CONFIG, fieldConfigSchema, tooltipSettingsKey } from './defaults';

/** Bind one entity type's sparse tooltip-field overrides to React state. */
export function useTooltipFieldConfig(entity: EntityKind) {
  return useUserSetting(tooltipSettingsKey(entity), fieldConfigSchema, EMPTY_FIELD_CONFIG);
}
