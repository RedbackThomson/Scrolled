import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDataset } from './index';

let workDir: string;

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), 'dataset-builder-'));
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('buildDataset', () => {
  it('writes manifest, checksums, and channel pointing at the version', async () => {
    const inputPath = join(workDir, 'game.scrolled-backup');
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    await writeFile(inputPath, payload);
    const out = join(workDir, 'repo');

    const result = await buildDataset({
      input: inputPath,
      out,
      family: 'local',
      version: '2026-06-20',
      displayName: 'Local Dataset',
      serverProfile: 'vanilla-v83',
    });

    const expectedSha = createHash('sha256').update(payload).digest('hex');
    expect(result.manifest.id).toBe('local-2026-06-20');
    expect(result.manifest.serverProfileId).toBe('vanilla-v83');
    expect(result.manifest.artifact.sha256).toBe(expectedSha);
    expect(result.manifest.artifact.url).toBe('local/2026-06-20/game.scrolled-backup');

    const channel = JSON.parse(await readFile(join(out, 'local', 'latest.json'), 'utf8'));
    expect(channel).toMatchObject({
      family: 'local',
      channel: 'latest',
      version: '2026-06-20',
      manifestUrl: 'local/2026-06-20/manifest.json',
    });

    const copied = await readFile(join(out, 'local', '2026-06-20', 'game.scrolled-backup'));
    expect(new Uint8Array(copied)).toEqual(payload);
  });
});
