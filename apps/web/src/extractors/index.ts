// Extractor layer.
//
// Consumes a GameDataSource (the parser-layer interface), produces normalized
// domain records validated by Zod. Pure functions where practical. No React,
// no SQLite, no I/O beyond the GameDataSource methods.

import type { GameDataSource } from '@/parser';

export interface Extractor<T> {
  extract(source: GameDataSource): Promise<T[]>;
}

export { extractItems } from './extractItems';
export type { ExtractItemsResult } from './extractItems';
export { extractEquips } from './extractEquips';
export type { ExtractEquipsResult } from './extractEquips';
export { extractMobs } from './extractMobs';
export type { ExtractMobsResult } from './extractMobs';
export { extractNpcs } from './extractNpcs';
export type { ExtractNpcsResult } from './extractNpcs';
export { extractMaps } from './extractMaps';
export type { ExtractMapsResult } from './extractMaps';
export { extractQuests } from './extractQuests';
export type { ExtractQuestsResult } from './extractQuests';
export { extractSkills } from './extractSkills';
export type { ExtractSkillsResult } from './extractSkills';
export { extractJobs, getBaseJobId } from './extractJobs';
export type { ExtractJobsResult } from './extractJobs';
