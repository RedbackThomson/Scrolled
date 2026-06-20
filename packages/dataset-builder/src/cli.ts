#!/usr/bin/env -S node --experimental-strip-types

// Thin CLI wrapper around buildDataset. Example:
//
//   node --experimental-strip-types packages/dataset-builder/src/cli.ts \
//     --input ~/Downloads/scrolled-game-2026-06-20.scrolled-backup \
//     --out apps/web/public/datasets \
//     --family local --version 2026-06-20 --display-name "Local Dataset"

import { buildDataset, type BuildDatasetOptions } from './index.ts';

const REQUIRED = ['input', 'out', 'family', 'version', 'display-name'] as const;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function usage(): never {
  console.error(
    'Usage: scrolled-dataset --input <backup> --out <dir> --family <name> --version <ver> --display-name <name>\n' +
      '                        [--channel latest] [--id <id>] [--data-revision <n>] [--build-timestamp <iso>]',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const missing = REQUIRED.filter((k) => !args[k]);
  if (missing.length > 0) {
    console.error(`Missing required flag(s): ${missing.map((k) => `--${k}`).join(', ')}`);
    usage();
  }

  const options: BuildDatasetOptions = {
    input: args.input,
    out: args.out,
    family: args.family,
    version: args.version,
    displayName: args['display-name'],
    channel: args.channel,
    id: args.id,
    dataRevision: args['data-revision'] ? Number(args['data-revision']) : undefined,
    buildTimestamp: args['build-timestamp'],
  };

  const result = await buildDataset(options);
  console.log(`Built dataset ${result.manifest.id}`);
  console.log(`  artifact:  ${result.manifest.artifact.url} (${result.manifest.artifact.sizeBytes} bytes)`);
  console.log(`  sha256:    ${result.manifest.artifact.sha256}`);
  console.log(`  channel:   ${result.channelPath}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
