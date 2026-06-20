import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WzMapleVersionName } from '../../src/parser';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Real WZ archives (`.wz` files), gitignored. */
const FIXTURES_DIR = resolve(__dirname, '../fixtures/wz');
/** Root of a real IMG dataset: a folder tree of `.img` files (gitignored). */
const IMG_DIR = resolve(__dirname, '../fixtures/img');

export interface LocalFixture {
  name: string;
  path: string;
}

/** One `.img` file from the local IMG dataset, with its dataset-relative path. */
export interface ImgFixtureFile {
  /** Slash-separated path relative to the IMG dataset root (e.g. `Mob/0100100.img`). */
  relPath: string;
  /** Absolute filesystem path. */
  path: string;
}

const VALID_VERSIONS = new Set<WzMapleVersionName>(['BMS', 'GMS', 'EMS', 'CLASSIC']);

export function wzVersionFromEnv(): WzMapleVersionName {
  const raw = process.env.SCROLLED_WZ_VERSION?.toUpperCase() as WzMapleVersionName | undefined;
  // MapleRoyals (v83-era client) uses the "old GMS" WZ encryption.
  if (!raw) return 'GMS';
  if (!VALID_VERSIONS.has(raw)) throw new Error(`Unknown SCROLLED_WZ_VERSION=${raw}`);
  return raw;
}

export function getLocalFixture(name: string): LocalFixture | null {
  const path = resolve(FIXTURES_DIR, name);
  if (!existsSync(path)) return null;
  return { name, path };
}

export function requireLocalFixture(name: string): LocalFixture {
  const fixture = getLocalFixture(name);
  if (!fixture) {
    throw new Error(
      `Missing local fixture: ${name}\n` +
        `Drop the file in apps/web/test/fixtures/wz/ to run this test.\n` +
        `See that directory's README for details.`,
    );
  }
  return fixture;
}

/**
 * Returns true when the file is available. Tests use this with `it.skipIf(...)`
 * so CI stays green without proprietary fixtures.
 */
export function hasLocalFixture(name: string): boolean {
  return getLocalFixture(name) !== null;
}

/**
 * Recursively gather every `.img` file under the local IMG dataset root
 * (`test/fixtures/img/`), returning each with its dataset-relative path.
 * Empty when the directory is absent, so tests `skipIf` cleanly on CI.
 */
export function gatherImgFixtures(): ImgFixtureFile[] {
  if (!existsSync(IMG_DIR)) return [];
  const out: ImgFixtureFile[] = [];
  for (const entry of readdirSync(IMG_DIR, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.img$/i.test(entry.name)) continue;
    const abs = resolve(entry.parentPath, entry.name);
    out.push({ relPath: relative(IMG_DIR, abs).split(sep).join('/'), path: abs });
  }
  return out;
}

export function hasImgFixtures(): boolean {
  return gatherImgFixtures().length > 0;
}
