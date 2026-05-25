/**
 * Build the WZ AES keystream of `numBlocks` 16-byte blocks.
 *
 * The chain is:
 *   block[0] = AES_Encrypt(key, IV repeated 4×)
 *   block[i] = AES_Encrypt(key, block[i-1])
 *
 * which is exactly AES-CBC with `IV` as the initial 16-byte IV and an
 * all-zero plaintext (each block XORs into 0, so the encrypted chain falls
 * out unchanged). WebCrypto's AES-CBC requires PKCS#7 padding, so
 * encrypting `numBlocks * 16` plaintext bytes returns `(numBlocks + 1) * 16`
 * ciphertext bytes; the first `numBlocks * 16` are the keystream we want.
 *
 * Works in browser/Worker (WebCrypto) and Node 18+ (globalThis.crypto.subtle).
 */
export async function aesChainEncryptZeros(
  key: Uint8Array,
  ivBlock: Uint8Array,
  numBlocks: number,
): Promise<Uint8Array> {
  if (numBlocks === 0) return new Uint8Array(0);
  if (key.length !== 32) {
    throw new RangeError(`AES-256 key must be 32 bytes, got ${key.length}`);
  }
  if (ivBlock.length !== 16) {
    throw new RangeError(`AES IV block must be 16 bytes, got ${ivBlock.length}`);
  }
  const subtle = globalThis.crypto.subtle;
  // Copy inputs into fresh ArrayBuffer-backed views: TS's WebCrypto types
  // now require `ArrayBufferView<ArrayBuffer>` (not the SharedArrayBuffer
  // union), and callers may hand us views whose backing is the workspace's
  // `ArrayBufferLike` widening.
  const keyBuf = new Uint8Array(new ArrayBuffer(key.length));
  keyBuf.set(key);
  const ivBuf = new Uint8Array(new ArrayBuffer(ivBlock.length));
  ivBuf.set(ivBlock);
  const cryptoKey = await subtle.importKey('raw', keyBuf, { name: 'AES-CBC', length: 256 }, false, [
    'encrypt',
  ]);
  const plaintext = new Uint8Array(new ArrayBuffer(numBlocks * 16));
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: 'AES-CBC', iv: ivBuf }, cryptoKey, plaintext),
  );
  // CBC + PKCS#7 returns one extra padding block; drop it.
  return ciphertext.subarray(0, numBlocks * 16);
}
