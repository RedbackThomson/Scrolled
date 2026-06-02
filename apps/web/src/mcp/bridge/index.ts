// Public bridge entry. `startMcpBridge` wires a transport, dispatcher and
// the in-process registry together; `stopMcpBridge` tears them down.
// `restartMcpBridgeFromSettings` is the live-toggle path used by the
// Settings panel — flip the toggle, the bridge restarts in place without
// requiring a reload.

import { createLogger } from '@/lib/logger';
import { buildToolContext } from '../context';
import { getToolRegistry, type ToolRegistry } from '../registry';
import type { ToolContext } from '../types';
import { BridgeDispatcher } from './dispatcher';
import {
  DEFAULT_BRIDGE_SETTINGS,
  type BridgeSettings,
  readBridgeSettings,
} from './settings';
import { setBridgeStatus } from './status';
import type { BridgeTransport } from './transport';
import { WebSocketTransport } from './webSocketTransport';

const log = createLogger('mcp/bridge');

interface ActiveBridge {
  transport: BridgeTransport;
  dispatcher: BridgeDispatcher;
  settings: BridgeSettings;
}

let active: ActiveBridge | null = null;

export interface StartOptions {
  registry: ToolRegistry;
  context: ToolContext;
  settings: BridgeSettings;
  /** Optional custom transport — used by tests to inject a fake. */
  transport?: BridgeTransport;
}

export async function startMcpBridge(opts: StartOptions): Promise<void> {
  if (active) await stopMcpBridge();
  const transport =
    opts.transport ?? new WebSocketTransport({ url: opts.settings.url });
  transport.onStatusChange((status, reason) => setBridgeStatus(status, reason));
  const dispatcher = new BridgeDispatcher({
    registry: opts.registry,
    context: opts.context,
    transport,
  });
  active = { transport, dispatcher, settings: opts.settings };
  try {
    await transport.open();
  } catch (e) {
    log.warn('failed to open bridge', { err: e instanceof Error ? e.message : String(e) });
  }
}

export async function stopMcpBridge(): Promise<void> {
  if (!active) return;
  try {
    active.transport.close();
  } finally {
    active = null;
    setBridgeStatus('idle');
  }
}

/** Called by `subscribeBridgeSettings` listeners. Re-reads the prefs row
 *  through the same async loader so a successful `writeBridgeSettings` and
 *  a manual restart converge on the same code path. */
export async function restartMcpBridgeFromSettings(next?: BridgeSettings): Promise<void> {
  const settings = next ?? (await readBridgeSettings());
  if (!settings.enabled) {
    await stopMcpBridge();
    return;
  }
  await startMcpBridge({
    registry: getToolRegistry(),
    context: buildToolContext(),
    settings,
  });
}

// Re-export so `apps/web/src/mcp/index.ts` can resolve the symbols without
// reaching past the bridge barrel.
export { DEFAULT_BRIDGE_SETTINGS };
