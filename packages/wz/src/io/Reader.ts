/**
 * Cursor over a `Uint8Array`. Mutable `position`; `clone()` produces an
 * independent cursor over the same backing bytes so concurrent parses don't
 * share state. No global locking is needed as long as each task holds its
 * own `Reader` instance.
 */
export class Reader {
  readonly buf: Uint8Array;
  readonly view: DataView;
  position: number;

  constructor(buf: Uint8Array, position = 0) {
    this.buf = buf;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.position = position;
  }

  get length(): number {
    return this.buf.byteLength;
  }

  get remaining(): number {
    return this.buf.byteLength - this.position;
  }

  clone(position: number = this.position): Reader {
    return new Reader(this.buf, position);
  }

  seek(position: number): void {
    if (position < 0 || position > this.buf.byteLength) {
      throw new RangeError(`seek out of range: ${position} (len ${this.buf.byteLength})`);
    }
    this.position = position;
  }

  skip(n: number): void {
    this.seek(this.position + n);
  }

  private ensure(n: number): void {
    if (this.position + n > this.buf.byteLength) {
      throw new RangeError(
        `read past end: need ${n} bytes at ${this.position} (len ${this.buf.byteLength})`,
      );
    }
  }

  readUInt8(): number {
    this.ensure(1);
    return this.view.getUint8(this.position++);
  }

  readInt8(): number {
    this.ensure(1);
    return this.view.getInt8(this.position++);
  }

  readUInt16LE(): number {
    this.ensure(2);
    const v = this.view.getUint16(this.position, true);
    this.position += 2;
    return v;
  }

  readInt16LE(): number {
    this.ensure(2);
    const v = this.view.getInt16(this.position, true);
    this.position += 2;
    return v;
  }

  readUInt32LE(): number {
    this.ensure(4);
    const v = this.view.getUint32(this.position, true);
    this.position += 4;
    return v;
  }

  readInt32LE(): number {
    this.ensure(4);
    const v = this.view.getInt32(this.position, true);
    this.position += 4;
    return v;
  }

  readUInt64LE(): bigint {
    this.ensure(8);
    const v = this.view.getBigUint64(this.position, true);
    this.position += 8;
    return v;
  }

  readInt64LE(): bigint {
    this.ensure(8);
    const v = this.view.getBigInt64(this.position, true);
    this.position += 8;
    return v;
  }

  readFloat32LE(): number {
    this.ensure(4);
    const v = this.view.getFloat32(this.position, true);
    this.position += 4;
    return v;
  }

  readFloat64LE(): number {
    this.ensure(8);
    const v = this.view.getFloat64(this.position, true);
    this.position += 8;
    return v;
  }

  /** Returns a *view* on the underlying buffer — no copy. */
  readBytes(n: number): Uint8Array {
    this.ensure(n);
    const view = this.buf.subarray(this.position, this.position + n);
    this.position += n;
    return view;
  }

  /** Returns an independent copy of the next `n` bytes. */
  readBytesCopy(n: number): Uint8Array {
    return new Uint8Array(this.readBytes(n));
  }

  /** Fixed-length ASCII string. Bytes are interpreted as Latin-1 / ASCII. */
  readAscii(n: number): string {
    const bytes = this.readBytes(n);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
    return s;
  }

  /** Null-terminated ASCII string, length not known in advance. */
  readNullTerminatedAscii(): string {
    let s = '';
    while (this.position < this.buf.byteLength) {
      const b = this.view.getUint8(this.position++);
      if (b === 0) return s;
      s += String.fromCharCode(b);
    }
    return s;
  }

  /**
   * WZ "compressed int32": read one int8. If it is `-128`, the real value is
   * the next four bytes as int32; otherwise the int8 value is the result.
   */
  readCompressedInt32(): number {
    const sb = this.readInt8();
    if (sb === -128) return this.readInt32LE();
    return sb;
  }

  /**
   * WZ "compressed int64": read one int8. If it is `-128`, the real value is
   * the next eight bytes as int64; otherwise the int8 value is the result.
   * Returns a bigint so the full int64 range is preserved.
   */
  readCompressedInt64(): bigint {
    const sb = this.readInt8();
    if (sb === -128) return this.readInt64LE();
    return BigInt(sb);
  }

  /**
   * WZ "compressed float32": read one int8. If it is `-128`, the real value
   * is the next four bytes as float32; otherwise the int8 value is the result
   * as a float (used for "round" values that fit in a signed byte).
   */
  readCompressedFloat32(): number {
    const sb = this.readInt8();
    if (sb === -128) return this.readFloat32LE();
    return sb;
  }
}
