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
// `exposeOnPort` is the dedicated engine: it exposes on each port handed to it
// by the broker (or the client, in the no-SharedWorker fallback), so all tabs
// share this one connection. See exposeOnPort.ts.
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
