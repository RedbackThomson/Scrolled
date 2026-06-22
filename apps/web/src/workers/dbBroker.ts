import { runBroker } from '@/workers/sharedWorkerBroker';

// SharedWorker entry for the game DB. Spawns the one dedicated engine worker
// that holds the OPFS connection and forwards every tab's port to it.
const engine = new Worker(new URL('@/workers/dbWorker.ts', import.meta.url), {
  type: 'module',
  name: 'scrolled-db-engine',
});

runBroker(engine);
