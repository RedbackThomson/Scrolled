// MCP subsystem — public barrel.
//
// Everything inside `apps/web/src/mcp/` is self-contained: the rest of the
// app only imports from this file. `initMcp()` registers tools and starts
// the bridge if the user has opted in via the Settings toggle; flipping
// that toggle later restarts the bridge in place without a reload.

import { startMcpBridge, stopMcpBridge, restartMcpBridgeFromSettings } from './bridge';
import { buildToolContext } from './context';
import { getToolRegistry } from './registry';
import { registerAllTools } from './tools';
import { readBridgeSettings, subscribeBridgeSettings } from './bridge/settings';

export { getToolRegistry, type ToolRegistry } from './registry';
export { buildToolContext } from './context';
export type { ToolContext, ToolDefinition, ToolMetadata, ToolCategory } from './types';
export {
  ValidationError,
  NotFoundError,
  ConflictError,
  OperationError,
  UnsupportedError,
  ToolExecutionError,
} from './errors';
export { BridgeSettingsPanel } from './components/BridgeSettingsPanel';
export { BridgeStatusIndicator } from './components/BridgeStatusIndicator';
export { useBridgeStatus } from './bridge/status';
export { McpPaletteProvider } from './paletteProviders/bridge';
export { readBridgeSettings, writeBridgeSettings } from './bridge/settings';

let initialized = false;

/**
 * Initialise the MCP subsystem. Idempotent — safe to call from `main.tsx`
 * during React StrictMode's double-effect dance. The registry is built
 * unconditionally so unit tests and the palette can list tools regardless
 * of the bridge toggle.
 */
export function initMcp(): void {
  if (initialized) return;
  initialized = true;

  const registry = getToolRegistry();
  registerAllTools(registry);

  // Auto-start the bridge if the user enabled it on a previous session.
  // `readBridgeSettings` is async (uiPref lives in OPFS); fire-and-forget
  // so module init stays sync.
  void readBridgeSettings().then((settings) => {
    if (settings.enabled) {
      void startMcpBridge({ registry, context: buildToolContext(), settings });
    }
  });

  // Live-restart on toggle / URL change.
  subscribeBridgeSettings((next) => {
    void restartMcpBridgeFromSettings(next);
  });
}

export { startMcpBridge, stopMcpBridge };
