// Source-file discovery for the build CLI.
//
// Extraction reads a fixed set of logical WZ files (the same set the web app's
// parser pool routes). We load only those — pulling in everything would waste
// time on unused archives and choke on special files like `List.wz` (an
// encrypted name list, not a directory tree).

import { readdirSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import type { DataSourceKind, LoadFileSpec } from '../parser';

/** Logical WZ files the extractors consume. Order is irrelevant. */
export const EXTRACTION_WZ_FILES = [
  'String.wz',
  'Item.wz',
  'Character.wz',
  'Mob.wz',
  'Npc.wz',
  'Map.wz',
  'Quest.wz',
  'Skill.wz',
] as const;

/** Top-level folders in an IMG dataset, mirroring the WZ file stems. */
const EXTRACTION_IMG_FOLDERS = new Set(EXTRACTION_WZ_FILES.map((f) => f.replace(/\.wz$/i, '')));

/** Decide WZ vs IMG from the directory contents unless forced. */
export function detectKind(dir: string, forced?: DataSourceKind): DataSourceKind {
  if (forced) return forced;
  const top = readdirSync(dir, { withFileTypes: true });
  return top.some((e) => e.isFile() && /\.wz$/i.test(e.name)) ? 'wz' : 'img';
}

/**
 * Gather the `LoadFileSpec`s for a source directory, restricted to the files
 * extraction actually reads. For WZ, matches logical file names; for IMG,
 * matches each file's first path segment against the extraction folders.
 */
export function gatherSourceFiles(dir: string, kind: DataSourceKind): LoadFileSpec[] {
  if (kind === 'wz') {
    const wanted = new Set<string>(EXTRACTION_WZ_FILES.map((f) => f.toLowerCase()));
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && wanted.has(e.name.toLowerCase()))
      .map((e) => ({ name: e.name, source: resolve(dir, e.name) }));
  }
  const out: LoadFileSpec[] = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.img$/i.test(entry.name)) continue;
    const abs = resolve(entry.parentPath, entry.name);
    const relPath = relative(dir, abs).split(sep).join('/');
    const topFolder = relPath.split('/')[0] ?? '';
    if (!EXTRACTION_IMG_FOLDERS.has(topFolder)) continue;
    out.push({ name: relPath, source: abs });
  }
  return out;
}
