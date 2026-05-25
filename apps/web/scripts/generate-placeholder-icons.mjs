import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Placeholder PWA icon: slate-900 background, slate-200 disc centered.
// Mirrors apps/web/public/icon.svg so the SVG and PNGs stay visually identical.
// Regenerate with `node apps/web/scripts/generate-placeholder-icons.mjs`.

const BG = [0x0f, 0x17, 0x2a, 0xff];
const FG = [0xe2, 0xe8, 0xf0, 0xff];

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function renderPng(size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size * 140) / 512;
  const r2 = r * r;
  const rowLen = 1 + size * 4;
  const raw = Buffer.alloc(rowLen * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowLen] = 0;
    const dy = y - cy + 0.5;
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const inside = dx * dx + dy * dy < r2;
      const c = inside ? FG : BG;
      const o = y * rowLen + 1 + x * 4;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
      raw[o + 3] = c[3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'public');
mkdirSync(outDir, { recursive: true });
for (const size of [192, 512]) {
  const out = resolve(outDir, `icon-${size}.png`);
  writeFileSync(out, renderPng(size));
  console.log(`wrote ${out}`);
}
