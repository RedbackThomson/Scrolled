import { Buffer } from 'node:buffer';
import * as zlib from 'node:zlib';
import { describe, it, expect, beforeAll } from 'vitest';
import {
  WzFile,
  WzMapleVersion,
  WzImage,
  WzCanvasProperty,
  WzSubProperty,
  WzPngProperty,
  type WzObject,
} from '@tybys/wz';
import { Reader } from '@/io/Reader';
import { readHeader } from '@/file/header';
import { computeVersionHash } from '@/file/versionHash';
import { readDirectory, type WzDirNode } from '@/file/directory';
import { readImage } from '@/img/readImage';
import { decodeCanvas } from '@/img/canvas/decode';
import { getKeystream } from '@/crypto/keystream';
import type { WzCanvasProperty as OurCanvas, WzProperty } from '@/img/property';
import { hasLocalFixture, readFixture } from '../helpers/localFixtures';

function* canvases(
  props: WzProperty[],
  base: string[] = [],
): Generator<{ path: string[]; canvas: OurCanvas }> {
  for (const p of props) {
    const path = [...base, p.name];
    if (p.type === 'canvas') {
      yield { path, canvas: p };
      yield* canvases(p.children, path);
    } else if (p.type === 'sub' || p.type === 'convex') {
      yield* canvases(p.children, path);
    }
  }
}

function findOracleCanvas(node: WzObject, path: string[]): WzCanvasProperty | null {
  let cur: WzObject | null = node;
  for (const seg of path) {
    if (!cur) return null;
    if (cur instanceof WzImage || cur instanceof WzSubProperty || cur instanceof WzCanvasProperty) {
      cur = cur.at(seg);
    } else {
      return null;
    }
  }
  return cur instanceof WzCanvasProperty ? cur : null;
}

/** Decode raw pixels via @tybys/wz's static decoders + the BGRA→RGBA swap. */
function oracleRgba(
  raw: Uint8Array,
  width: number,
  height: number,
  format: number,
): Uint8ClampedArray {
  // The oracle's static decoders are TS-private but runtime-accessible.
  const png = WzPngProperty as unknown as {
    getPixelDataBgra4444(raw: Uint8Array, w: number, h: number): Uint8Array;
    getPixelDataDXT3(raw: Uint8Array, w: number, h: number): Uint8Array;
    getPixelDataDXT5(raw: Uint8Array, w: number, h: number): Uint8Array;
  };
  let bgra: Uint8Array;
  switch (format) {
    case 1:
      bgra = png.getPixelDataBgra4444(raw, width, height);
      break;
    case 2:
      bgra = raw;
      break;
    case 3:
    case 1026:
      bgra = png.getPixelDataDXT3(raw, width, height);
      break;
    case 2050:
      bgra = png.getPixelDataDXT5(raw, width, height);
      break;
    default:
      throw new Error(`oracle has no decoder for format ${format}`);
  }
  // Swap BGRA → RGBA.
  const out = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < out.length; i += 4) {
    out[i + 0] = bgra[i + 2]!;
    out[i + 1] = bgra[i + 1]!;
    out[i + 2] = bgra[i + 0]!;
    out[i + 3] = bgra[i + 3]!;
  }
  return out;
}

const FIXTURE = 'Item.wz';
const present = hasLocalFixture(FIXTURE);

describe.skipIf(!present)(`canvas pixel decode parity vs @tybys/wz (${FIXTURE})`, () => {
  let oracle: WzFile;
  let ours: WzDirNode;
  let bytes: Uint8Array;
  let keystream: Uint8Array;

  beforeAll(async () => {
    bytes = readFixture(FIXTURE);
    oracle = new WzFile(bytes as unknown as File, WzMapleVersion.GMS);
    (oracle as unknown as { name: string }).name = FIXTURE;
    await oracle.parseWzFile();
    const header = readHeader(new Reader(bytes));
    const mapleVersion = (oracle as unknown as { mapleStoryPatchVersion: number })
      .mapleStoryPatchVersion;
    const { hash } = computeVersionHash(mapleVersion);
    keystream = await getKeystream('GMS', 256 * 1024);
    ours = readDirectory({
      reader: new Reader(bytes, header.dataStart + 2),
      header,
      versionHash: hash,
      keystream,
      name: FIXTURE,
    });
  });

  it('decodes the first 10 canvases byte-identically to @tybys/wz', async () => {
    let checked = 0;
    let format1Seen = 0;
    let format2Seen = 0;

    outer: for (const dir of ours.children) {
      if (dir.kind !== 'dir') continue;
      for (const sub of (dir as WzDirNode).children) {
        if (sub.kind !== 'image') continue;

        const parsed = readImage({
          reader: new Reader(bytes, sub.offset),
          imageOffset: sub.offset,
          keystream,
        });
        for (const c of canvases(parsed.properties)) {
          if (c.canvas.width === 0 || c.canvas.height === 0) continue;
          const code = c.canvas.format1 + c.canvas.format2;
          if (code !== 1 && code !== 2) continue;

          // Locate the same canvas in the oracle.
          const oracleImage = (oracle.at(dir.name) as unknown as { at(n: string): WzObject | null })
            ?.at(sub.name) as WzImage | null;
          if (!oracleImage) continue;
          await oracleImage.parseImage();
          const oracleCanvas = findOracleCanvas(oracleImage, c.path);
          if (!oracleCanvas) continue;
          const oraclePng = (oracleCanvas as unknown as { pngProperty: WzPngProperty })
            .pngProperty;
          const oracleRaw = await oraclePng.getCompressedBytes(true);

          // Skip listWz-encoded canvases — those are tested separately.
          // (None should show up in MapleRoyals v83, but be defensive.)
          if (oracleRaw[0] !== 0x78) continue;

          // Sanity check: our payload bytes byte-match the oracle's.
          const oursPayloadStart = c.canvas.dataOffset + 4 + 1;
          const dv = new DataView(bytes.buffer, bytes.byteOffset);
          const rawLenAtOffset = dv.getInt32(c.canvas.dataOffset, true);
          const oursPayloadLen = rawLenAtOffset - 1;
          const oursPayload = bytes.subarray(
            oursPayloadStart,
            oursPayloadStart + oursPayloadLen,
          );
          expect(oursPayload.length).toBe(oracleRaw.length);
          for (let i = 0; i < oursPayload.length; i++) {
            if (oursPayload[i] !== oracleRaw[i]) {
              throw new Error(
                `payload byte mismatch at ${dir.name}/${sub.name}/${c.path.join('/')} offset ${i}`,
              );
            }
          }

          const oursPixels = await decodeCanvas({ canvas: c.canvas, fileBytes: bytes, keystream });
          expect(oursPixels.width).toBe(c.canvas.width);
          expect(oursPixels.height).toBe(c.canvas.height);

          // Decompress the oracle's same bytes through the same lenient
          // streaming inflate, then run @tybys/wz's static expanders. Both
          // sides see identical raw decompressed bytes.
          const oracleDecompressed = await new Promise<Uint8Array>((resolve) => {
            const chunks: Buffer[] = [];
            const s = zlib.createInflate();
            s.on('data', (c2: Buffer) => chunks.push(c2));
            s.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))));
            s.on('error', () => resolve(new Uint8Array(Buffer.concat(chunks))));
            s.end(oracleRaw);
          });
          const expected = oracleRgba(oracleDecompressed, c.canvas.width, c.canvas.height, code);

          expect(oursPixels.rgba.length).toBe(expected.length);
          // Sample a handful of pixels for fast equality. Then full equality.
          for (let i = 0; i < expected.length; i++) {
            if (oursPixels.rgba[i] !== expected[i]) {
              throw new Error(
                `pixel mismatch at byte ${i} for ${dir.name}/${sub.name}/${c.path.join('/')}: ours=${oursPixels.rgba[i]} oracle=${expected[i]}`,
              );
            }
          }

          if (code === 1) format1Seen++;
          else format2Seen++;
          checked++;
          if (checked >= 10) break outer;
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`canvases checked: ${checked} (format=1: ${format1Seen}, format=2: ${format2Seen})`);
    expect(checked).toBeGreaterThan(0);
  });
});
