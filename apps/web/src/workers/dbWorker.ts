/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { Sqlite } from '@/db/sqlite';
import { DbApi, gameDataPreMigrateReset } from '@/db/queries';
import { createLogger } from '@/lib/logger';
import { lazyOpenProxy } from '@/lib/lazyOpenProxy';

const log = createLogger('db-worker');
log.info('db worker started');

// `lazyOpenProxy` forwards every `DbApi` method automatically and lazily
// runs `open()` on first call. Adding a method to `DbApi` no longer
// requires a parallel registration here — previously each new entity
// surface needed a per-method `await ensureOpen()` wrapper, and forgetting
// one silently produced a `rawValue.apply undefined` comlink error.
expose(lazyOpenProxy(new DbApi(new Sqlite({ resetBeforeMigrate: gameDataPreMigrateReset })), log));
