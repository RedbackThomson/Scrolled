// Central registration point — every tool the registry knows about is reached
// from this file. New domain = new file + one entry in `ALL_TOOLS`. The
// dispatcher and palette consume `registry.list()` so order here is purely
// organizational; tool ids stay stable.

import type { ToolRegistry } from '../registry';
import { chairTools } from './chairs';
import { collectionTools } from './collections';
import { groupTools } from './collectionGroups';
import { dbTools } from './db';
import { equipmentTools } from './equipment';
import { importExportTools } from './importExport';
import { itemTools } from './items';
import { jobTools } from './jobs';
import { libraryTools } from './library';
import { mapTools } from './maps';
import { monsterTools } from './monsters';
import { noteTools } from './notes';
import { npcTools } from './npcs';
import { pinnedTools } from './pinnedSearches';
import { questTools } from './quests';
import { questChainTools } from './questChains';
import { searchTools } from './search';
import { serverProfileTools } from './serverProfiles';
import { settingsTools } from './settings';
import { skillTools } from './skills';

const ALL_TOOLS = [
  ...mapTools,
  ...itemTools,
  ...equipmentTools,
  ...monsterTools,
  ...npcTools,
  ...questTools,
  ...questChainTools,
  ...jobTools,
  ...skillTools,
  ...chairTools,
  ...searchTools,
  ...collectionTools,
  ...groupTools,
  ...noteTools,
  ...pinnedTools,
  ...settingsTools,
  ...serverProfileTools,
  ...dbTools,
  ...libraryTools,
  ...importExportTools,
];

export function registerAllTools(registry: ToolRegistry): void {
  for (const tool of ALL_TOOLS) {
    registry.register(tool);
  }
}
