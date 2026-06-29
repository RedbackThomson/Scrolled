// Tiny CLI: compile an authored graph and write the JSON form to disk or stdout.
//
//   pnpm --filter @scrolled/nav-graph export
//       writes the default registered graph to ./nav-graph.json
//   pnpm --filter @scrolled/nav-graph export -- --graph=<id>
//       picks a specific graph from src/graphs/index.ts
//   pnpm --filter @scrolled/nav-graph export -- --source=/abs/path/to/graph.ts
//       compiles an external authored file (default-export `NavGraphSource`).
//       Used by downstream deploys that keep their graph data out of this repo.
//   pnpm --filter @scrolled/nav-graph export -- --out=foo.json
//   pnpm --filter @scrolled/nav-graph export -- --stdout
//   pnpm --filter @scrolled/nav-graph export -- --list
//
// Run through vite-node so the `@/*` alias resolves the same way Vitest does,
// and so external --source files written in TypeScript can be loaded without
// a separate build step.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileGraph } from '../compile/compileGraph';
import { DEFAULT_GRAPH_ID, getGraph, listGraphIds } from '../graphs/index';
import type { NavGraphSource } from '../ir/types';
import { toJSON } from '../json/toJSON';

interface CliArgs {
  out: string;
  stdout: boolean;
  graph: string;
  source: string | null;
  list: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let out = 'nav-graph.json';
  let stdout = false;
  let graph = DEFAULT_GRAPH_ID;
  let source: string | null = null;
  let list = false;
  for (const arg of argv) {
    if (arg === '--stdout') stdout = true;
    else if (arg === '--list') list = true;
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
    else if (arg.startsWith('--graph=')) graph = arg.slice('--graph='.length);
    else if (arg.startsWith('--source=')) source = arg.slice('--source='.length);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }
  return { out, stdout, graph, source, list };
}

function printHelp(): void {
  console.log(
    [
      'Usage: nav-graph export [--graph=<id> | --source=<path>] [--out=<path>] [--stdout] [--list]',
      '',
      'Compiles an authored graph and emits the portable JSON form.',
      `  --graph=<id>   profile id to export from the in-repo registry (default: ${DEFAULT_GRAPH_ID})`,
      '  --source=<path> load NavGraphSource from an external TS/JS file (default export)',
      '  --out=<path>   write to <path> (default: ./nav-graph.json)',
      '  --stdout       write to stdout instead of a file',
      '  --list         list registered graph ids and exit',
    ].join('\n'),
  );
}

async function loadExternalSource(sourcePath: string): Promise<NavGraphSource> {
  const abs = isAbsolute(sourcePath) ? sourcePath : resolve(process.cwd(), sourcePath);
  // Use a file:// URL so dynamic import treats this as an absolute filesystem
  // path on every platform (Windows path resolution otherwise rejects it).
  const mod = await import(pathToFileURL(abs).href);
  const candidate = mod.default ?? mod.graph;
  if (!candidate || typeof candidate !== 'object') {
    throw new Error(
      `External source "${abs}" must default-export a NavGraphSource ` +
        `(got: ${candidate === undefined ? 'undefined' : typeof candidate}).`,
    );
  }
  return candidate as NavGraphSource;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const id of listGraphIds()) console.log(id);
    return;
  }

  let source: NavGraphSource | undefined;
  let label: string;
  if (args.source) {
    source = await loadExternalSource(args.source);
    label = args.source;
  } else {
    source = getGraph(args.graph);
    label = args.graph;
    if (!source) {
      console.error(
        `Unknown graph "${args.graph}". Registered: ${listGraphIds().join(', ')}`,
      );
      process.exit(1);
    }
  }

  const graph = compileGraph(source);
  const json = JSON.stringify(toJSON(graph), null, 2);

  if (args.stdout) {
    process.stdout.write(`${json}\n`);
    return;
  }
  const outPath = resolve(process.cwd(), args.out);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${json}\n`, 'utf8');
  console.log(
    `Wrote ${label} (${graph.nodes.size} nodes, ${graph.source.edges.length} edges) to ${outPath}`,
  );
}

void main();
