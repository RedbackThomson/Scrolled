import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WzVersion } from '@/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Reuses the app's gitignored fixtures directory so contributors only need to
// drop their WZ files once.
const FIXTURES_DIR = resolve(__dirname, '../../../../apps/web/test/fixtures/local');

const VALID_VERSIONS: ReadonlySet<WzVersion> = new Set([
  'BMS',
  'GMS',
  'EMS',
  'MSEA',
  'CLASSIC',
]);

export function wzVersionFromEnv(): WzVersion {
  const raw = process.env.MGE_WZ_VERSION?.toUpperCase() as WzVersion | undefined;
  // MapleRoyals (v83-era client) uses the "old GMS" WZ encryption.
  if (!raw) return 'GMS';
  if (!VALID_VERSIONS.has(raw)) throw new Error(`Unknown MGE_WZ_VERSION=${raw}`);
  return raw;
}

export function hasLocalFixture(name: string): boolean {
  return existsSync(resolve(FIXTURES_DIR, name));
}

export function fixturePath(name: string): string {
  return resolve(FIXTURES_DIR, name);
}

export function readFixture(name: string): Uint8Array {
  const buf = readFileSync(fixturePath(name));
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}
