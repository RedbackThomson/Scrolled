import { BUILTIN_PROFILES } from './registry';
import type { ServerProfile } from './types';

/**
 * Reads the string value at a WZ path, or null if it's absent / not a string.
 * Decouples detection from how the value is fetched (parser worker in the app,
 * a plain map in tests).
 */
export type FingerprintReader = (file: string, path: string) => Promise<string | null>;

/**
 * Scan profiles' fingerprints and return the first profile whose fingerprint
 * matches, or null when none do. Matching is a case-insensitive substring test
 * against the string value the reader returns. Profiles are checked in
 * registry order, so the baseline (which carries no fingerprints) is naturally
 * skipped.
 *
 * Reads are cached per (file, path) so several profiles sharing a fingerprint
 * source only pay one lookup.
 */
export async function detectServerProfile(read: FingerprintReader): Promise<ServerProfile | null> {
  const cache = new Map<string, string | null>();
  const readCached = async (file: string, path: string): Promise<string | null> => {
    const key = `${file}/${path}`;
    if (cache.has(key)) return cache.get(key)!;
    let value: string | null = null;
    try {
      value = await read(file, path);
    } catch {
      value = null;
    }
    cache.set(key, value);
    return value;
  };

  for (const profile of BUILTIN_PROFILES) {
    for (const fp of profile.fingerprints ?? []) {
      const value = await readCached(fp.file, fp.path);
      if (value && value.toLowerCase().includes(fp.contains.toLowerCase())) {
        return profile;
      }
    }
  }
  return null;
}
