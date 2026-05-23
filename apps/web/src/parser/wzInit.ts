import wzWasmUrl from '@tybys/wz/dist/wz.wasm?url';
import { crypto as wzCrypto } from '@tybys/wz/lib/esm-modern/util/node.js';
import { createLogger, describeError } from '@/lib/logger';

const log = createLogger('wz-init');

let pending: Promise<void> | null = null;
let aesSmokeOk: { ok: true } | { ok: false; error: string } | null = null;

type EmscriptenFactory = (opts: { locateFile?: (file: string) => string }) => Promise<unknown>;

interface AesLike {
  update(buf: Uint8Array): Uint8Array;
  final(): Uint8Array;
  setAutoPadding(pad: boolean): AesLike;
  destroy(): unknown;
}

type AesCreate = (key: Uint8Array) => AesLike;

/**
 * Initialize the `@tybys/wz` WASM crypto runtime and wire it into the
 * library's `crypto` polyfill.
 *
 * Two Vite/Rollup interop issues with the library's UMD WASM loader
 * (`lib/esm-modern/util/wz.js`) force us to bypass its own `init()`:
 *
 *   1. The library does `await wzWasm.default(opts)`. Under webpack's CJS
 *      interop `wzWasm.default` is the Emscripten factory; under Vite/Rollup
 *      it's the whole CJS namespace, so the call throws "not a function".
 *      We probe for the factory on `.default` (webpack) or `.default.default`
 *      (Vite).
 *
 *   2. The library does `import { aesCreate } from './wz.js'` in `node.js`.
 *      Rollup's static CJS interop doesn't synthesize that named export from
 *      the UMD's runtime `e.aesCreate = …` assignment, so `aesCreate` is
 *      `undefined` and `crypto.createCipheriv('aes-256-ecb', …)` silently
 *      returns `undefined` — image parsing then fails without throwing and
 *      the UI shows empty children for every `.img`.
 *
 *      We patch `crypto.createCipheriv` directly with a working implementation
 *      that calls the live `aesCreate` we read off the same module namespace.
 *      `crypto` is an exported object, so mutating its method is visible to
 *      the library's `WzMutableKey` which calls `crypto.createCipheriv` at
 *      decrypt time.
 *
 * In Node (Vitest) this never runs — the worker isn't created and the library
 * uses native `require('crypto')`.
 */
export function ensureWzInit(): Promise<void> {
  if (!pending) {
    pending = run();
  }
  return pending;
}

async function run(): Promise<void> {
  log.info('init start', { wasmUrl: wzWasmUrl });

  const wzWasm = (await import('@tybys/wz/lib/esm-modern/util/wz.js')) as Record<string, unknown>;
  log.debug('wz.js imported', { topKeys: Object.keys(wzWasm) });

  const ns = unwrapCjsNamespace(wzWasm);
  if (!ns) {
    log.error('could not unwrap wz.js CJS namespace', { topKeys: Object.keys(wzWasm) });
    throw new Error('[mge] could not locate @tybys/wz module namespace');
  }
  log.debug('cjs namespace located', { keys: Object.keys(ns).slice(0, 20) });

  const factory = resolveFactory(ns);
  if (!factory) {
    log.error('no Emscripten factory found on namespace', { keys: Object.keys(ns) });
    throw new Error('[mge] @tybys/wz Emscripten factory not exported');
  }

  log.info('calling Emscripten factory', { wasmUrl: wzWasmUrl });
  try {
    await factory({
      locateFile: (file: string) => (file.endsWith('.wasm') ? wzWasmUrl : file),
    });
    log.info('Emscripten factory resolved');
  } catch (e) {
    log.error('Emscripten factory threw', describeError(e));
    throw e;
  }

  const aesCreate = ns.aesCreate as AesCreate | undefined;
  if (typeof aesCreate !== 'function') {
    log.error('aesCreate not exposed by wz.js after init', { keys: Object.keys(ns) });
    throw new Error('[mge] aesCreate not found on @tybys/wz namespace after init');
  }
  log.debug('aesCreate captured');

  patchCryptoPolyfill(aesCreate);
  log.info('crypto polyfill patched');

  aesSmokeOk = runAesSmokeTest(aesCreate);
  if (aesSmokeOk.ok) {
    log.info('aes smoke test passed');
  } else {
    log.error('aes smoke test failed', { error: aesSmokeOk.error });
  }
}

function patchCryptoPolyfill(aesCreate: AesCreate): void {
  type Createable = { createCipheriv: (a: string, k: Uint8Array, iv: unknown) => AesLike };
  (wzCrypto as Createable).createCipheriv = (algo, key) => {
    if (algo !== 'aes-256-ecb') {
      throw new Error(`[mge] unsupported cipher ${algo}`);
    }
    return aesCreate(key);
  };
}

/**
 * AES-256-ECB known-answer test from FIPS 197 Appendix C.3.
 *
 * Key:        000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f
 * Plaintext:  00112233445566778899aabbccddeeff
 * Ciphertext: 8ea2b7ca516745bfeafc49904b496089
 *
 * If this passes, the WASM cipher produces correct AES-256-ECB output. If it
 * fails (wrong bytes), the library's actual decryption will also produce
 * garbage — `parseImage()` will silently return false because the decrypted
 * property-name string won't equal the expected literal `"Property"`.
 */
function runAesSmokeTest(aesCreate: AesCreate): { ok: true } | { ok: false; error: string } {
  try {
    const key = hexToBytes('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    const plaintext = hexToBytes('00112233445566778899aabbccddeeff');
    const expected = '8ea2b7ca516745bfeafc49904b496089';

    // Single block, fresh cipher.
    const c1 = aesCreate(key);
    c1.setAutoPadding(false);
    const out1 = c1.update(plaintext);
    c1.destroy();
    if (!out1 || out1.length !== 16) {
      return { ok: false, error: `single-block update returned ${out1?.length ?? 0} bytes` };
    }
    const got1 = bytesToHex(out1);
    if (got1 !== expected) {
      return {
        ok: false,
        error: `AES-256-ECB known-answer mismatch: got ${got1}, expected ${expected}`,
      };
    }

    // Re-create a cipher and verify state cleanup (the library calls
    // createCipheriv many times).
    const c2 = aesCreate(key);
    c2.setAutoPadding(false);
    const out2 = c2.update(plaintext);
    c2.destroy();
    if (bytesToHex(out2) !== expected) {
      return { ok: false, error: 'cipher re-create produced different output' };
    }

    // Multi-block test — the library calls update() in a loop with
    // 16-byte plaintexts.
    const c3 = aesCreate(key);
    c3.setAutoPadding(false);
    const a = c3.update(plaintext);
    const b = c3.update(plaintext);
    c3.destroy();
    if (bytesToHex(a) !== expected || bytesToHex(b) !== expected) {
      return { ok: false, error: 'multi-block update produced inconsistent output' };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? String(e) };
  }
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

/**
 * Last-known smoke-test result, surfaced via `WzDataSource.diagnose()`. The
 * value is set inside `run()` so it's only meaningful after `ensureWzInit()`
 * has resolved.
 */
export function getAesSmokeTestResult(): { ok: true } | { ok: false; error: string } {
  return aesSmokeOk ?? { ok: false, error: 'wz init has not run yet' };
}

/**
 * Vite's dynamic-import result wraps the CJS module namespace under `.default`.
 * Webpack/esbuild may put it at the top level. Return whichever side has the
 * UMD's runtime exports (recognizable by an `aesCreate` or `default` function).
 */
function unwrapCjsNamespace(mod: Record<string, unknown>): Record<string, unknown> | null {
  if (looksLikeWzNamespace(mod)) return mod;
  const inner = mod.default;
  if (
    inner &&
    typeof inner === 'object' &&
    looksLikeWzNamespace(inner as Record<string, unknown>)
  ) {
    return inner as Record<string, unknown>;
  }
  return null;
}

function looksLikeWzNamespace(obj: Record<string, unknown>): boolean {
  return typeof obj.default === 'function' || typeof obj.aesCreate === 'function';
}

function resolveFactory(ns: Record<string, unknown>): EmscriptenFactory | null {
  return typeof ns.default === 'function' ? (ns.default as EmscriptenFactory) : null;
}
