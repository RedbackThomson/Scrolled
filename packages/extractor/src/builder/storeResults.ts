// The single owner of "how an extractor's output lands in the database": the
// upsert + relation calls, and the FK ordering they imply. Every extraction
// path — the headless `runExtraction`, the legacy single-worker `useExtractAll`,
// and the wizard's parallel pool — funnels its results through these functions,
// so the persistence sequence can't drift between them.
//
// Each `store*` takes an already-`open`ed database and one extractor's result,
// performs the writes, and returns the counts the callers report. Chairs FK into
// items, so `storeChairs` must run after `storeItems` (the pool path enforces
// that ordering with a cross-worker barrier; the sequential paths get it for
// free by call order).

import type { GameDatabase } from '@scrolled/game-db/db';
import type {
  ExtractChairsResult,
  ExtractEquipsResult,
  ExtractItemsResult,
  ExtractJobsResult,
  ExtractMapsResult,
  ExtractMobsResult,
  ExtractNpcsResult,
  ExtractQuestsResult,
  ExtractSkillsResult,
  ExtractWorldMapsResult,
} from '../extractors';

export interface StoredCounts {
  /** Rows written to the primary table. */
  rows: number;
  /** Entries the extractor skipped (malformed / unsupported). */
  skipped: number;
  /** Quest names that fell back to a placeholder; 0 for other extractors. */
  placeholderNames: number;
}

export async function storeItems(db: GameDatabase, r: ExtractItemsResult): Promise<StoredCounts> {
  const rows = r.items.length > 0 ? await db.upsertItems(r.items) : 0;
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeChairs(db: GameDatabase, r: ExtractChairsResult): Promise<StoredCounts> {
  const rows = r.chairs.length > 0 ? await db.upsertChairs(r.chairs) : 0;
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeEquips(db: GameDatabase, r: ExtractEquipsResult): Promise<StoredCounts> {
  const rows = r.equips.length > 0 ? await db.upsertEquips(r.equips) : 0;
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeMobs(db: GameDatabase, r: ExtractMobsResult): Promise<StoredCounts> {
  const rows = r.mobs.length > 0 ? await db.upsertMobs(r.mobs) : 0;
  if (r.drops.length > 0) await db.replaceMobDrops(r.drops);
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeNpcs(db: GameDatabase, r: ExtractNpcsResult): Promise<StoredCounts> {
  const rows = r.npcs.length > 0 ? await db.upsertNpcs(r.npcs) : 0;
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeMaps(db: GameDatabase, r: ExtractMapsResult): Promise<StoredCounts> {
  const rows = r.maps.length > 0 ? await db.upsertMaps(r.maps) : 0;
  if (r.mapMarks.length > 0) await db.upsertMapMarks(r.mapMarks);
  if (
    r.mapNpcs.length > 0 ||
    r.mapMobs.length > 0 ||
    r.mapPortals.length > 0 ||
    r.mapMobSpawns.length > 0
  ) {
    await db.replaceMapLife({
      npcs: r.mapNpcs,
      mobs: r.mapMobs,
      portals: r.mapPortals,
      mobSpawns: r.mapMobSpawns,
    });
  }
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeWorldMaps(
  db: GameDatabase,
  r: ExtractWorldMapsResult,
): Promise<StoredCounts> {
  const rows = r.worldMaps.length > 0 ? await db.upsertWorldMaps(r.worldMaps) : 0;
  if (r.markers.length > 0) await db.upsertWorldMapMarkers(r.markers);
  if (r.markerMaps.length > 0) await db.upsertWorldMapMarkerMaps(r.markerMaps);
  if (r.links.length > 0) await db.upsertWorldMapLinks(r.links);
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeQuests(db: GameDatabase, r: ExtractQuestsResult): Promise<StoredCounts> {
  const rows = r.quests.length > 0 ? await db.upsertQuests(r.quests) : 0;
  if (r.requirements.length > 0 || r.rewards.length > 0) {
    await db.replaceQuestRelations({ requirements: r.requirements, rewards: r.rewards });
  }
  return { rows, skipped: r.skipped.length, placeholderNames: r.placeholderNames };
}

export async function storeJobs(db: GameDatabase, r: ExtractJobsResult): Promise<StoredCounts> {
  const rows = r.jobs.length > 0 ? await db.upsertJobs(r.jobs) : 0;
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

export async function storeSkills(db: GameDatabase, r: ExtractSkillsResult): Promise<StoredCounts> {
  const rows = r.skills.length > 0 ? await db.upsertSkills(r.skills) : 0;
  if (r.levels.length > 0 || r.prerequisites.length > 0) {
    await db.replaceSkillRelations({ levels: r.levels, prerequisites: r.prerequisites });
  }
  return { rows, skipped: r.skipped.length, placeholderNames: 0 };
}

/** Quest chains are a pure DB derivation, not an extraction — always run last. */
export async function storeQuestChains(db: GameDatabase): Promise<StoredCounts> {
  const rows = await db.computeAndStoreQuestChains();
  return { rows, skipped: 0, placeholderNames: 0 };
}
