import { runBroker } from '@/workers/sharedWorkerBroker';

// SharedWorker entry for the user DB. Spawns the one dedicated engine worker
// that holds the OPFS connection and forwards every tab's port to it.
const engine = new Worker(new URL('@/workers/userDbWorker.ts', import.meta.url), {
  type: 'module',
  name: 'scrolled-user-db-engine',
});

runBroker(engine);
