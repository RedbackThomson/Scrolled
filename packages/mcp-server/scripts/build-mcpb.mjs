// Build a .mcpb (Claude Desktop extension) bundle for the Scrolled MCP server.
//
// Output: dist/scrolled.mcpb — a zip containing:
//   manifest.json           DXT manifest declaring the server + user config.
//   server/index.cjs        Single-file CommonJS bundle of cli.ts and every
//                           workspace/runtime dep (sdk, ws, zod, etc.).
//
// Bundling to CJS avoids the ESM-vs-Node-version footguns the original
// `node --experimental-strip-types ./src/cli.ts` invocation hit on older
// runtimes. The bundled file runs with plain `node index.cjs` on Node 18+.

import { build } from 'esbuild';
import { mkdir, rm, cp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, '..');
const distRoot = path.join(pkgRoot, 'dist');
const stageRoot = path.join(distRoot, 'scrolled-mcpb');
const outFile = path.join(distRoot, 'scrolled.mcpb');

async function clean() {
  if (existsSync(distRoot)) await rm(distRoot, { recursive: true, force: true });
  await mkdir(path.join(stageRoot, 'server'), { recursive: true });
}

async function bundle() {
  await build({
    entryPoints: [path.join(pkgRoot, 'src', 'cli.ts')],
    outfile: path.join(stageRoot, 'server', 'index.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    sourcemap: false,
    minify: false,
    // The MCP SDK probes optional transport implementations at runtime; we
    // don't use them here, so suppress the missing-dep warnings esbuild
    // would otherwise emit.
    logLevel: 'error',
    // ws ships a native Buffer fallback that esbuild can safely tree-shake.
    legalComments: 'none',
  });
}

async function copyManifest() {
  const manifestPath = path.join(pkgRoot, 'mcpb', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  // Keep the manifest version in sync with the package version.
  const pkg = JSON.parse(await readFile(path.join(pkgRoot, 'package.json'), 'utf8'));
  if (pkg.version && pkg.version !== '0.0.0') manifest.version = pkg.version;
  await writeFile(
    path.join(stageRoot, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  // Carry forward optional icon if it exists.
  const iconSrc = path.join(pkgRoot, 'mcpb', 'icon.png');
  if (existsSync(iconSrc)) await cp(iconSrc, path.join(stageRoot, 'icon.png'));
}

function zipBundle() {
  // System `zip` is universally available on macOS / Linux dev shells and
  // produces a valid .zip without an extra Node dependency. `-r .` walks
  // the staged tree from inside it so the archive contains
  // `manifest.json` and `server/index.cjs` at the root, which is what the
  // DXT loader expects.
  const res = spawnSync('zip', ['-r', '-X', outFile, '.'], {
    cwd: stageRoot,
    stdio: 'inherit',
  });
  if (res.status !== 0) {
    throw new Error(`zip exited with status ${res.status}`);
  }
}

async function main() {
  await clean();
  await bundle();
  await copyManifest();
  zipBundle();
  process.stdout.write(`\nBuilt ${path.relative(pkgRoot, outFile)}\n`);
}

main().catch((err) => {
  process.stderr.write(`build:mcpb failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
