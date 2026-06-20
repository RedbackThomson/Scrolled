// Minimal USTAR tar reader/writer over Uint8Array. No dependencies.
//
// Only what the backup format needs: a handful of regular files with short
// ASCII names, stored uncompressed and contiguous. Not a general-purpose tar —
// no symlinks, directories, or long-name (PAX/GNU) extensions.

const BLOCK = 512;

export interface TarEntry {
  name: string;
  bytes: Uint8Array;
}

function writeAscii(buf: Uint8Array, offset: number, str: string, max: number): void {
  for (let i = 0; i < str.length && i < max; i++) buf[offset + i] = str.charCodeAt(i) & 0xff;
}

// 11-digit zero-padded octal + NUL, the layout the 12-byte size/mtime fields use.
function writeOctal12(buf: Uint8Array, offset: number, value: number): void {
  writeAscii(buf, offset, value.toString(8).padStart(11, '0'), 11);
  buf[offset + 11] = 0;
}

function paddedSize(byteLength: number): number {
  return Math.ceil(byteLength / BLOCK) * BLOCK;
}

export function packTar(entries: readonly TarEntry[]): Uint8Array {
  let total = BLOCK * 2; // two zero blocks terminate the archive
  for (const e of entries) total += BLOCK + paddedSize(e.bytes.byteLength);

  const out = new Uint8Array(total);
  let pos = 0;
  for (const e of entries) {
    const header = out.subarray(pos, pos + BLOCK);
    writeAscii(header, 0, e.name, 100); // name
    writeAscii(header, 100, '0000644', 7); // mode
    writeAscii(header, 108, '0000000', 7); // uid
    writeAscii(header, 116, '0000000', 7); // gid
    writeOctal12(header, 124, e.bytes.byteLength); // size
    writeOctal12(header, 136, 0); // mtime — fixed for reproducible output
    header[156] = 0x30; // typeflag '0': regular file
    writeAscii(header, 257, 'ustar', 5); // magic
    header[263] = 0x30;
    header[264] = 0x30; // version "00"

    // Checksum is the sum of all header bytes with the checksum field itself
    // taken as ASCII spaces.
    for (let i = 148; i < 156; i++) header[i] = 0x20;
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) sum += header[i];
    writeAscii(header, 148, sum.toString(8).padStart(6, '0'), 6);
    header[154] = 0;
    header[155] = 0x20;

    pos += BLOCK;
    out.set(e.bytes, pos);
    pos += paddedSize(e.bytes.byteLength);
  }
  return out;
}

function readAscii(buf: Uint8Array, offset: number, max: number): string {
  let end = offset;
  const limit = offset + max;
  while (end < limit && buf[end] !== 0) end++;
  let s = '';
  for (let i = offset; i < end; i++) s += String.fromCharCode(buf[i]);
  return s;
}

function readOctal(buf: Uint8Array, offset: number, max: number): number {
  const s = readAscii(buf, offset, max).trim();
  return s ? parseInt(s, 8) : 0;
}

export function unpackTar(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let pos = 0;
  while (pos + BLOCK <= bytes.byteLength) {
    const header = bytes.subarray(pos, pos + BLOCK);
    if (header.every((b) => b === 0)) break; // zero block marks the end
    const name = readAscii(header, 0, 100);
    const size = readOctal(header, 124, 12);
    pos += BLOCK;
    entries.push({ name, bytes: bytes.slice(pos, pos + size) });
    pos += paddedSize(size);
  }
  return entries;
}
