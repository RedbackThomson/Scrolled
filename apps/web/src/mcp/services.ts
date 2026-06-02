// Service-layer container for orchestration logic that lives outside the
// DbApi/UserDbApi surfaces. Most tools call `ctx.db` / `ctx.userDb` directly
// because the existing comlink workers already expose the right shape; only
// flows that the hooks coordinate themselves (e.g. import-with-conflict-mode
// JSON roundtrips) need a service entry here so the hook and the tool call
// one path. New service modules add a field below and a constructor entry in
// `createServices`.

export interface McpServices {
  // Filled as services are extracted from hooks. Empty today because every
  // v1 tool maps 1:1 to a DbApi/UserDbApi call; the field is reserved so
  // tool implementations can already accept `ctx.services` without churn.
  readonly _placeholder?: undefined;
}

export function createServices(): McpServices {
  return {};
}
