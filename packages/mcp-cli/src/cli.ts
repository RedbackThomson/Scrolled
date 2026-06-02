#!/usr/bin/env node
import { run } from './run.ts';

run({ argv: process.argv.slice(2) })
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
