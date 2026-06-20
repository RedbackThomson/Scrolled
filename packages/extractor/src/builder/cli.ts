// scrolled-dataset build — headless dataset builder.
//
// Reads a directory of `.wz` archives (or a folder tree of `.img` files),
// runs the full extraction pipeline under Node (no browser), and writes a
// SQLite database. Bundle packaging + manifest generation is layered on in
// `pack.ts`; this module owns arg parsing, fs I/O, version detection, and
// driving `runExtraction`.
//
// Run via vite-node so `import.meta.glob` (server profiles) and the
// sqlite-wasm asset resolve exactly as they do under Vitest:
//   pnpm dataset:build <wz-dir> --profile <id> --version <label> --out <dir>

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';

import { detectVersion, detectImageVersion } from '@scrolled/wz';
import { ensureWzInit } from '../parser/wzInit';
import { WzDataSource } from '../parser/WzDataSource';
import { ImgDataSource } from '../parser/ImgDataSource';
import type { DataSourceKind, GameDataSource, LoadFileSpec, WzMapleVersionName } from '../parser';
import { Sqlite } from '../db/sqlite';
import { DbApi } from '../db/queries';
import { packBackup } from '../db/backup';
import {
  resolveServerProfile,
  serverProfileExists,
  serverProfileSchema,
  type ServerProfile,
} from '../serverProfiles';
import { createLogger, describeError } from '../lib/logger';
import { runExtraction } from './runExtraction';
import { detectKind, gatherSourceFiles } from './files';
import { writeDatasetRepo } from './pack';

const log = createLogger('dataset-cli');

const SUPPORTED_WZ_VERSIONS: WzMapleVersionName[] = ['BMS', 'GMS', 'EMS', 'CLASSIC'];

interface CliArgs {
  wzDir: string;
  profileId?: string;
  profileFile?: string;
  version: string;
  displayName?: string;
  out: string;
  family?: string;
  channel?: string;
  kind?: DataSourceKind;
  wzVersion?: WzMapleVersionName;
}

function parseArgs(argv: string[]): CliArgs {
  const [command, ...rest] = argv;
  if (command !== 'build') {
    fail(`Unknown command '${command ?? ''}'. Usage: scrolled-dataset build <wz-dir> [options]`);
  }
  let wzDir: string | undefined;
  const opts: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = rest[i + 1];
      if (val === undefined || val.startsWith('--')) fail(`Missing value for --${key}`);
      opts[key] = val!;
      i++;
    } else if (!wzDir) {
      wzDir = a;
    } else {
      fail(`Unexpected argument '${a}'`);
    }
  }
  if (!wzDir) fail('Missing <wz-dir> argument');
  if (!opts.version) fail('Missing required --version <label> (e.g. 2026-06-01)');
  if (!opts.out) fail('Missing required --out <dir>');
  if (!opts.profile && !opts['profile-file']) {
    fail('Provide --profile <id> or --profile-file <path>');
  }
  const kind = opts.kind as DataSourceKind | undefined;
  if (kind && kind !== 'wz' && kind !== 'img') fail(`--kind must be 'wz' or 'img'`);
  const wzVersion = opts['wz-version'] as WzMapleVersionName | undefined;
  if (wzVersion && !SUPPORTED_WZ_VERSIONS.includes(wzVersion)) {
    fail(`--wz-version must be one of ${SUPPORTED_WZ_VERSIONS.join(', ')}`);
  }
  return {
    wzDir: resolve(wzDir!),
    profileId: opts.profile,
    profileFile: opts['profile-file'],
    version: opts.version,
    displayName: opts['display-name'],
    out: resolve(opts.out),
    family: opts.family,
    channel: opts.channel,
    kind,
    wzVersion,
  };
}

function fail(message: string): never {
  log.error(message);
  process.stderr.write(`\nerror: ${message}\n`);
  process.exit(1);
}

/** Resolve the server profile from a builtin id or a `--profile-file` JSON. */
function loadProfile(args: CliArgs): ServerProfile {
  if (args.profileFile) {
    const raw = JSON.parse(readFileSync(args.profileFile, 'utf8')) as unknown;
    const parsed = serverProfileSchema.safeParse(raw);
    if (!parsed.success) fail(`Invalid --profile-file: ${parsed.error.message}`);
    return parsed.data;
  }
  if (!serverProfileExists(args.profileId!)) {
    fail(`Unknown --profile '${args.profileId}'. It is not a built-in profile.`);
  }
  return resolveServerProfile(args.profileId!);
}

/**
 * Auto-detect the WZ encryption version from a representative file. Prefers
 * String (small, almost all text) for confident scoring. Returns null when
 * detection is inconclusive — the caller should ask for `--wz-version`.
 */
async function detectWzVersion(
  files: LoadFileSpec[],
  kind: DataSourceKind,
): Promise<WzMapleVersionName | null> {
  const pick = (re: RegExp) => files.find((f) => re.test(basename(f.name)));
  if (kind === 'wz') {
    const rep = pick(/^String\.wz$/i) ?? files[0];
    if (!rep) return null;
    const bytes = readFileSync(rep.source as string);
    const result = await detectVersion(new Uint8Array(bytes));
    return result ? coerceVersion(result.version) : null;
  }
  const rep = pick(/Mob\.img$/i) ?? pick(/\.img$/i) ?? files[0];
  if (!rep) return null;
  const bytes = readFileSync(rep.source as string);
  const result = await detectImageVersion(new Uint8Array(bytes));
  return result ? coerceVersion(result.version) : null;
}

/** Map a detected `WzVersion` onto the data source's supported set. */
function coerceVersion(v: string): WzMapleVersionName | null {
  return (SUPPORTED_WZ_VERSIONS as string[]).includes(v) ? (v as WzMapleVersionName) : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.wzDir)) fail(`Source directory not found: ${args.wzDir}`);

  const profile = loadProfile(args);
  const calculatorId = profile.systems.equipStatCalculation;
  if (!calculatorId) {
    fail(`Profile '${profile.id}' declares no equip-stat calculator (systems.equipStatCalculation).`);
  }
  const displayName = args.displayName ?? profile.name;
  const family = args.family ?? profile.id;
  const kind = detectKind(args.wzDir, args.kind);
  const files = gatherSourceFiles(args.wzDir, kind);
  if (files.length === 0) fail(`No ${kind === 'wz' ? '.wz' : '.img'} files found in ${args.wzDir}`);

  log.info('build start', {
    wzDir: args.wzDir,
    kind,
    files: files.length,
    profile: profile.id,
    version: args.version,
  });

  const wzVersion = args.wzVersion ?? (await detectWzVersion(files, kind));
  if (!wzVersion) {
    fail(
      'Could not auto-detect the WZ encryption version. ' +
        `Pass --wz-version <${SUPPORTED_WZ_VERSIONS.join('|')}>.`,
    );
  }
  log.info('using wz version', { wzVersion });

  await ensureWzInit(wzVersion);
  const source: GameDataSource = kind === 'img' ? new ImgDataSource() : new WzDataSource();
  await source.init(wzVersion, kind);
  const loaded = await source.load(files);
  if (loaded.errors.length > 0) {
    for (const e of loaded.errors) log.error('load error', { file: e.name, message: e.message });
  }

  const sql = new Sqlite({ logTag: 'dataset-build' });
  const db = new DbApi(sql);
  await db.open();

  const stats = await runExtraction(source, db, {
    label: `${displayName} · ${args.version}`,
    wzVersion,
    sourceKind: kind,
    files: files.map((f) => ({
      name: f.name,
      size: statSync(f.source as string).size,
      hash: null,
      loadStatus: null,
      loadError: null,
    })),
    loadErrors: loaded.errors,
    onStage: (s) => process.stdout.write(`  ${s}\n`),
  });

  // Bake the server profile into the dataset's own game DB, so it travels
  // *as* the dataset rather than as a separate file the app applies on install.
  await db.setServerProfileConfig(profile);

  const gameBytes = await db.exportBytes();
  const status = await db.status();
  await source.dispose();

  // The bundle is the game SQLite in the existing tar+gzip container.
  process.stdout.write('  Packing bundle\n');
  const bundle = await packBackup({
    game: gameBytes,
    versions: {
      game: { schemaVersion: status.schemaVersion, dataRevision: status.dataRevision },
    },
  });

  const { manifest, artifactPath, channelPath } = writeDatasetRepo({
    out: args.out,
    family,
    version: args.version,
    displayName,
    serverProfileId: profile.id,
    calculatorId,
    dataRevision: status.dataRevision,
    schemaVersion: status.schemaVersion,
    channel: args.channel,
    bundle,
  });

  log.info('build complete', {
    artifactPath,
    bundleBytes: bundle.byteLength,
    counts: stats.counts,
  });
  process.stdout.write(
    `\nBuilt ${manifest.displayName} (${family}/${args.version})\n` +
      `  bundle:   ${artifactPath} (${(bundle.byteLength / 1_048_576).toFixed(1)} MB)\n` +
      `  manifest: dataRevision ${manifest.dataRevision}, schema ${manifest.schemaVersion}, ` +
      `profile ${manifest.serverProfileId}, calculator ${manifest.calculatorId}\n` +
      `  channel:  ${channelPath}\n`,
  );
}

main().catch((err) => {
  log.error('build failed', describeError(err));
  process.stderr.write(`\nbuild failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
