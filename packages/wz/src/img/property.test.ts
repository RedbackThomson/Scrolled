import { describe, it, expect } from 'vitest';
import { Reader } from '../io/Reader';
import { parsePropertyList } from './property';

const zeros = new Uint8Array(1024);

describe('parsePropertyList (synthetic)', () => {
  it('handles an empty property list (entryCount = 0)', () => {
    // Compressed int 0 = single byte 0x00
    const buf = new Uint8Array([0x00]);
    const props = parsePropertyList({
      reader: new Reader(buf),
      imageOffset: 0,
      keystream: zeros,
    });
    expect(props).toEqual([]);
  });
});
