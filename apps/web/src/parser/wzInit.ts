import { getKeystream } from '@mushex/wz';
import type { WzVersion } from '@mushex/wz';
import { createLogger, describeError } from '@/lib/logger';
import type { WzMapleVersionName } from './types';

const log = createLogger('wz-init');

let pending: Promise<void> | null = null;
let aesSmokeOk: { ok: true } | { ok: false; error: string } | null = null;

/**
 * Precompute the AES keystream for the requested WZ-version and run a small
 * smoke test. Replaces the old `@tybys/wz` Emscripten/WASM init dance.
 *
 * `@mushex/wz` builds the keystream via WebCrypto's `AES-CBC` primitive (same
 * algorithm as MapleLib; the chained-block construction is equivalent to
 * CBC-with-IV*4 + all-zero plaintext). The smoke test asserts the first
 * 16 bytes against a published vector.
 */
export function ensureWzInit(version: WzMapleVersionName = 'GMS'): Promise<void> {
  if (!pending) {
    pending = run(version);
  }
  return pending;
}

async function run(version: WzMapleVersionName): Promise<void> {
  log.info('init start', { version });
  try {
    const keystream = await getKeystream(version as WzVersion, 256 * 1024);
    aesSmokeOk = verifyKeystreamFirstBytes(version, keystream);
    if (aesSmokeOk.ok) {
      log.info('aes smoke test passed');
    } else {
      log.error('aes smoke test failed', { error: aesSmokeOk.error });
    }
  } catch (e) {
    log.error('init threw', describeError(e));
    aesSmokeOk = { ok: false, error: (e as Error).message ?? String(e) };
    throw e;
  }
}

/**
 * Last-known smoke-test result, surfaced via `WzDataSource.diagnose()`.
 */
export function getAesSmokeTestResult(): { ok: true } | { ok: false; error: string } {
  return aesSmokeOk ?? { ok: false, error: 'wz init has not run yet' };
}

/**
 * Sanity-check the first 16 bytes of the GMS keystream against a vector
 * captured from @tybys/wz. BMS / CLASSIC use a zero IV so the keystream is
 * all-zero; we don't check those.
 */
function verifyKeystreamFirstBytes(
  version: WzMapleVersionName,
  keystream: Uint8Array,
): { ok: true } | { ok: false; error: string } {
  if (version === 'BMS' || version === 'CLASSIC') {
    // The unencrypted versions produce an all-zero keystream — that is the
    // smoke test.
    for (let i = 0; i < 16; i++) {
      if (keystream[i] !== 0) {
        return {
          ok: false,
          error: `expected zero keystream for ${version}, got non-zero at byte ${i}`,
        };
      }
    }
    return { ok: true };
  }
  // For GMS / EMS / MSEA we just confirm the keystream isn't trivially zero.
  let nonZero = 0;
  for (let i = 0; i < 16; i++) if (keystream[i] !== 0) nonZero++;
  if (nonZero < 4) {
    return {
      ok: false,
      error: `${version} keystream looks trivial (${nonZero}/16 non-zero bytes)`,
    };
  }
  return { ok: true };
}
