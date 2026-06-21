// Which WZ files each extractor needs — the extraction dependency graph.
//
// Domain knowledge, not UI: it describes what an extractor reads, independent of
// how any front-end drives it. The wizard consumes this to decide what a set of
// dropped files will produce (see apps/web buildPlan); the headless build always
// loads everything so it doesn't consult it.
//
//   - `primary` triggers the extractor. Its presence means "run this"; its
//     absence means "skip".
//   - `needs` are companion files the extractor cross-references (almost always
//     `String.wz` for localized names). Without them the extractor still runs
//     but produces empty/nameless rows — except where noted as a hard dep.
//   - `label` is the generic entity-type name shown in run UIs.

import type { ExtractorKey } from './extractStats';

export interface ExtractorFileDeps {
  label: string;
  primary: string;
  needs: readonly string[];
}

/**
 * `item`, `chair`, and `equip` share `Item.wz` as the primary: dropping it
 * triggers all three, processed sequentially within the items pool worker. Equip
 * stat blocks live in `Character.wz` (the per-equip `info` images); without it
 * the equip extractor can't populate attack/defense/requirements, so it's a hard
 * dep. Jobs piggy-back on the skills run (both keyed to `Skill.wz`).
 *
 * Keyed by `ExtractorKey`, so adding an extractor key elsewhere fails to compile
 * until its file deps are filled in here.
 */
export const EXTRACTOR_DEPS: Record<ExtractorKey, ExtractorFileDeps> = {
  item: { label: 'Items', primary: 'Item.wz', needs: ['String.wz'] },
  chair: { label: 'Chairs', primary: 'Item.wz', needs: ['String.wz'] },
  equip: { label: 'Equips', primary: 'Item.wz', needs: ['String.wz', 'Character.wz'] },
  mob: { label: 'Mobs', primary: 'Mob.wz', needs: ['String.wz'] },
  npc: { label: 'NPCs', primary: 'Npc.wz', needs: ['String.wz'] },
  map: { label: 'Maps', primary: 'Map.wz', needs: ['String.wz'] },
  // World maps read only Map.wz/WorldMap; labels come from the embedded MapList,
  // so String.wz isn't a dependency.
  worldMap: { label: 'World Maps', primary: 'Map.wz', needs: [] },
  quest: { label: 'Quests', primary: 'Quest.wz', needs: ['String.wz'] },
  job: { label: 'Jobs', primary: 'Skill.wz', needs: ['String.wz'] },
  skill: { label: 'Skills', primary: 'Skill.wz', needs: ['String.wz'] },
};
