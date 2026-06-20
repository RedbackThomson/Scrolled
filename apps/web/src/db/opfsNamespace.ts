// OPFS storage names for the game and user databases, namespaced per
// deployment.
//
// A fixed-dataset deployment isolates its storage so it never shares a database
// with the generic site — or with a different fixed dataset — on the same
// origin. The generic deployment keeps the original, unsuffixed names so
// existing users' libraries are untouched.
//
// Imported from both DB workers, which run in their own threads; `appConfig`
// resolves the same way there (Vite injects `import.meta.env` into workers).

import { appConfig } from '@/config';

const family = appConfig.fixedDataset?.family;
// Keep the suffix VFS-safe; family is already a slug but a stray character would
// otherwise leak into an OPFS path / pool name.
const suffix = family ? `-${family.replace(/[^a-z0-9-]/gi, '-')}` : '';

export const GAME_OPFS_FILENAME = `/scrolled${suffix}.sqlite3`;
export const GAME_POOL_NAME = `scrolled-db-pool${suffix}`;

export const USER_OPFS_FILENAME = `/user${suffix}.sqlite3`;
export const USER_POOL_NAME = `scrolled-user-db-pool${suffix}`;
