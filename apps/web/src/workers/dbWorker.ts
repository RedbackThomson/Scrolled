/// <reference lib="WebWorker" />
import { Sqlite } from '@scrolled/game-db/db/sqlite';
import { DbApi, gameDataPreMigrateReset } from '@scrolled/game-db/db/queries';
import { GAME_OPFS_FILENAME, GAME_POOL_NAME } from '@/db/opfsNamespace';
import { createLogger } from '@scrolled/game-db/lib/logger';
import { lazyOpenProxy } from '@/lib/lazyOpenProxy';
import { exposeOnPort } from '@/workers/exposeOnPort';

const log = createLogger('db-worker');
log.info('db worker started');

// `lazyOpenProxy` forwards every `DbApi` method automatically and lazily
// runs `open()` on first call. Adding a method to `DbApi` no longer
// requires a parallel registration here — previously each new entity
// surface needed a per-method `await ensureOpen()` wrapper, and forgetting
// one silently produced a `rawValue.apply undefined` comlink error.
//
// This is the dedicated engine: `exposeOnPort` exposes the API on each port the
// owning tab hands over, so every tab shares this one OPFS connection.
exposeOnPort(
  lazyOpenProxy(
    new DbApi(
      new Sqlite({
        opfsFilename: GAME_OPFS_FILENAME,
        poolName: GAME_POOL_NAME,
        resetBeforeMigrate: gameDataPreMigrateReset,
      }),
    ),
    log,
  ),
);
