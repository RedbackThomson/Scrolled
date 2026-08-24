import type { EntityKind } from '@/db';
import type { AnyTooltipEntityConfig } from './types';
import { itemConfig } from './item';
import { equipConfig } from './equip';
import { mobConfig } from './mob';
import { npcConfig } from './npc';
import { mapConfig } from './map';
import { questConfig } from './quest';
import { questChainConfig } from './questChain';
import { skillConfig } from './skill';

export const TOOLTIP_REGISTRY: Record<EntityKind, AnyTooltipEntityConfig> = {
  item: itemConfig,
  equip: equipConfig,
  mob: mobConfig,
  npc: npcConfig,
  map: mapConfig,
  quest: questConfig,
  questChain: questChainConfig,
  skill: skillConfig,
};

export * from './types';
export {
  tooltipSettingsKey,
  fieldConfigSchema,
  resolveModes,
  pruneOverrides,
  resetAllTooltips,
  EMPTY_FIELD_CONFIG,
  type StoredFieldConfig,
} from './defaults';
export { useTooltipFieldConfig } from './useTooltipFieldConfig';
