/// <reference lib="WebWorker" />
import { expose } from 'comlink';
import { UserDbApi } from '@/db/user/queries';
import { setOutboxListener } from '@/db/user/queries/sync';
import { OUTBOX_DOORBELL_CHANNEL, type OutboxDoorbellMessage } from '@/db/user/syncDoorbell';
import { createLogger } from '@scrolled/game-db/lib/logger';
import { lazyOpenProxy } from '@/lib/lazyOpenProxy';

const log = createLogger('user-db-worker');
log.info('user db worker started');

// Ring the cross-context doorbell whenever a mutation appends to the outbox, so
// the main-thread sync engine drains it (docs/sync_design.md §13). The channel
// exists in every build; with no engine listening it is a harmless no-op, and it
// pulls in zero provider/SDK code.
const outboxDoorbell = new BroadcastChannel(OUTBOX_DOORBELL_CHANNEL);
setOutboxListener((entity) => {
  outboxDoorbell.postMessage({ entity } satisfies OutboxDoorbellMessage);
});

// See `lazyOpenProxy` — forwards every `UserDbApi` method and opens the
// underlying SQLite handle on first call.
expose(lazyOpenProxy(new UserDbApi(), log));
