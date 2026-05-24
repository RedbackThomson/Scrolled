import { describe, it, expect } from 'vitest';
import { WzFile, WzMapleVersion } from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash, findVersionCandidates } from '@/file/versionHash';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

const FIXTURE = 'String.wz';
const present = hasLocalFixture(FIXTURE);

describe.skipIf(!present)('header + versionHash parity vs @tybys/wz (String.wz)', () => {
  it('reads the same header fields as @tybys/wz', async () => {
    const bytes = readFixture(FIXTURE);
    const ours = readHeader(new Reader(bytes));

    // Oracle parse — load the same bytes via @tybys/wz.
    const oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
    (oracle as unknown as { name: string }).name = FIXTURE;
    await oracle.parseWzFile();

    expect(ours.ident).toBe(oracle.header.ident);
    expect(ours.fileSize).toBe(oracle.header.fsize);
    expect(ours.dataStart).toBe(oracle.header.fstart);
    expect(ours.copyright).toBe(oracle.header.copyright);
    // encVersion is stored on the oracle as `_wzVersionHeader`.
    expect(ours.encVersion).toBe(
      (oracle as unknown as { _wzVersionHeader: number })._wzVersionHeader,
    );

    oracle.dispose();
  });

  it('brute-forces the same versionHash that @tybys/wz uses', async () => {
    const bytes = readFixture(FIXTURE);
    const header = readHeader(new Reader(bytes));

    const oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
    (oracle as unknown as { name: string }).name = FIXTURE;
    await oracle.parseWzFile();

    const oracleHash = (oracle as unknown as { _versionHash: number })._versionHash;
    const oracleMapleVersion = (
      oracle as unknown as { mapleStoryPatchVersion: number }
    ).mapleStoryPatchVersion;

    expect(oracleHash).toBeGreaterThan(0);
    expect(oracleMapleVersion).toBeGreaterThan(0);

    // Our brute force must produce the same hash for the same patch number.
    const ours = computeVersionHash(oracleMapleVersion);
    expect(ours.hash).toBe(oracleHash);
    expect(ours.encVersion).toBe(header.encVersion & 0xff);

    // The candidate list contains the oracle's choice.
    const candidates = findVersionCandidates(header.encVersion, 1000);
    expect(candidates.some((c) => c.mapleVersion === oracleMapleVersion)).toBe(true);

    oracle.dispose();
  });
});
