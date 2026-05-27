import { createLogger } from '@/lib/logger';
import { serverProfileSchema } from './schema';
import type { ServerProfile } from './types';

const log = createLogger('server-profiles');

export const DEFAULT_PROFILE_ID = 'vanilla-v83';

// Guaranteed baseline. Stays in code (not the directory) because it's the
// "no overrides" default the DB migration seeds and the fallback every other
// resolution path leans on — it must exist even if the profiles directory is
// empty. Server-specific profiles live as JSON in ./profiles.
const CLASSIC_PROFILE: ServerProfile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Classic',
  description: 'Unmodified rates and stat variance, matching the base game.',
  rates: { exp: 1 },
  systems: { equipStatCalculation: 'vanilla-v83' },
};

/**
 * Load every `*.json` profile in ./profiles. Vite bundles them at build time
 * via `import.meta.glob`, so dropping a file in the directory is enough to
 * ship a new profile — no code change. Each file is Zod-validated; an invalid
 * one is skipped with a warning rather than breaking the app.
 */
function loadProfileDirectory(): ServerProfile[] {
  const modules = import.meta.glob('./profiles/*.json', { eager: true });
  const out: ServerProfile[] = [];
  for (const [path, mod] of Object.entries(modules)) {
    const raw = (mod as { default: unknown }).default;
    const result = serverProfileSchema.safeParse(raw);
    if (!result.success) {
      log.warn(`skipping invalid server profile ${path}`, result.error.issues);
      continue;
    }
    out.push(result.data);
  }
  return out;
}

function buildProfiles(): ServerProfile[] {
  const byId = new Map<string, ServerProfile>([[CLASSIC_PROFILE.id, CLASSIC_PROFILE]]);
  for (const profile of loadProfileDirectory()) {
    if (byId.has(profile.id)) {
      log.warn(`duplicate server profile id "${profile.id}" ignored`);
      continue;
    }
    byId.set(profile.id, profile);
  }
  return [...byId.values()];
}

/**
 * All shipped profiles: the baseline plus every valid file in the directory.
 * "Built-in" in the sense that they're bundled into the deployed build —
 * runtime never fetches them.
 */
export const BUILTIN_PROFILES: readonly ServerProfile[] = buildProfiles();

/** Resolve a profile id to its definition, falling back to the baseline. */
export function resolveServerProfile(profileId: string | null | undefined): ServerProfile {
  return BUILTIN_PROFILES.find((p) => p.id === profileId) ?? BUILTIN_PROFILES[0];
}
