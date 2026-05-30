/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { UserDbApi } from '@/db/user/queries';
import { createLogger } from '@/lib/logger';
import { lazyOpenProxy } from '@/lib/lazyOpenProxy';

const log = createLogger('user-db-worker');
log.info('user db worker started');

// See `lazyOpenProxy` — forwards every `UserDbApi` method and opens the
// underlying SQLite handle on first call.
expose(lazyOpenProxy(new UserDbApi(), log));
