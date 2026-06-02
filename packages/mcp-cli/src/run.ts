// CLI orchestration. The CLI hosts its own WS server briefly and waits
// for the open browser tab to connect, then runs one command and exits.
// Because the browser only ever bridges to one host, you can run either
// `scrolled-mcp-server` or `scrolled-mcp` — not both at once — and the
// Settings → External Tools toggle will dial the one that's listening.

import { BridgeHost, type CallToolOutcome } from '@scrolled/mcp-bridge-client';
import type { ToolMetadata } from '@scrolled/mcp-protocol';

export interface RunOptions {
  argv: string[];
  port?: number;
  host?: string;
  /** How long the CLI waits for the browser to connect before giving up. */
  connectTimeoutMs?: number;
}

interface ParsedCommand {
  command: 'list' | 'describe' | 'call' | 'help';
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): ParsedCommand {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq >= 0) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  const [first = 'help', ...rest] = positional;
  const valid = ['list', 'describe', 'call', 'help'] as const;
  const command = (valid as readonly string[]).includes(first)
    ? (first as ParsedCommand['command'])
    : 'help';
  return { command, positional: rest, flags };
}

function helpText(): string {
  return `scrolled-mcp — invoke MCP tools against the open Scrolled tab

Usage:
  scrolled-mcp list                            List every registered tool
  scrolled-mcp describe <tool>                 Print tool description + input JSON schema
  scrolled-mcp call <tool> [--input '<json>']  Invoke a tool. Defaults to {} if --input omitted.

Flags:
  --port <n>          WS port to host (default 8765, env MCP_BRIDGE_PORT)
  --host <h>          WS host to bind (default 127.0.0.1)
  --timeout <ms>      How long to wait for the browser tab (default 60000)

Notes:
  • The open Scrolled tab must have "External Tools" toggled on (Settings).
  • Run only one of scrolled-mcp / scrolled-mcp-server at a time — they share
    the WebSocket the browser dials into.
`;
}

async function awaitClient(host: BridgeHost, timeoutMs: number): Promise<void> {
  if (host.isClientConnected()) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for the browser tab to connect (${timeoutMs}ms)`)),
      timeoutMs,
    );
    const check = setInterval(() => {
      if (host.isClientConnected()) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

export async function run(opts: RunOptions): Promise<number> {
  const parsed = parseArgs(opts.argv);
  if (parsed.command === 'help') {
    process.stdout.write(helpText());
    return 0;
  }

  const port =
    opts.port ?? coerceNumber(parsed.flags.port) ?? coerceNumber(process.env.MCP_BRIDGE_PORT);
  const hostArg = opts.host ?? coerceString(parsed.flags.host);
  const timeoutMs = opts.connectTimeoutMs ?? coerceNumber(parsed.flags.timeout) ?? 60_000;

  const host = new BridgeHost({ port, host: hostArg });
  try {
    await host.start();
    await awaitClient(host, timeoutMs);

    switch (parsed.command) {
      case 'list': {
        const cat = await host.discover();
        for (const t of cat.tools) {
          process.stdout.write(`${t.name.padEnd(36)}  [${t.category}]  ${t.description}\n`);
        }
        return 0;
      }
      case 'describe': {
        const [name] = parsed.positional;
        if (!name) {
          process.stderr.write('describe: expected tool name\n');
          return 64;
        }
        const cat = await host.discover();
        const tool = cat.tools.find((t) => t.name === name);
        if (!tool) {
          process.stderr.write(`describe: no such tool "${name}"\n`);
          return 65;
        }
        process.stdout.write(`${tool.name}\n${''.padEnd(tool.name.length, '=')}\n`);
        process.stdout.write(`Category:    ${tool.category}\n`);
        process.stdout.write(`Description: ${tool.description}\n\n`);
        process.stdout.write(`Input schema:\n${JSON.stringify(tool.inputSchema, null, 2)}\n`);
        if (tool.outputSchema) {
          process.stdout.write(`\nOutput schema:\n${JSON.stringify(tool.outputSchema, null, 2)}\n`);
        }
        return 0;
      }
      case 'call': {
        const [name] = parsed.positional;
        if (!name) {
          process.stderr.write('call: expected tool name\n');
          return 64;
        }
        const inputRaw = coerceString(parsed.flags.input) ?? '{}';
        let input: unknown;
        try {
          input = JSON.parse(inputRaw);
        } catch (e) {
          process.stderr.write(
            `call: --input is not valid JSON: ${e instanceof Error ? e.message : String(e)}\n`,
          );
          return 64;
        }
        const outcome = await host.callTool(name, input);
        return printOutcome(outcome);
      }
    }
  } finally {
    await host.stop();
  }
  return 0;
}

function printOutcome(outcome: CallToolOutcome): number {
  if (outcome.ok) {
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
    return 0;
  }
  process.stderr.write(`${outcome.error.code}: ${outcome.error.message}\n`);
  if (outcome.error.details !== undefined) {
    process.stderr.write(`${JSON.stringify(outcome.error.details, null, 2)}\n`);
  }
  return 1;
}

function coerceNumber(v: string | boolean | undefined): number | undefined {
  if (v === undefined || typeof v === 'boolean') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function coerceString(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

// Suppress unused-export warning for ToolMetadata import; kept so future
// commands (e.g. `inspect`) can lean on the type.
void undefined as unknown as ToolMetadata | undefined;
