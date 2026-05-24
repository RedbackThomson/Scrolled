# @mge/wz

A self-contained TypeScript WZ-file parser used by Mushroom Game Explorer.

Why this exists instead of `@tybys/wz`:

- **Reentrant reads.** `Reader` is a cursor over a `Uint8Array`; `clone()` is free and concurrent parses don't share mutable position state. The app no longer needs a per-file mutex.
- **No `OffscreenCanvas` round-trip.** Canvas decoding produces `Uint8ClampedArray` of RGBA8888 directly. Callers wrap with `new ImageData(...) → createImageBitmap(...)` only when display is needed.
- **No WASM / no Emscripten.** AES-256 keystream is generated via WebCrypto (browser/Worker) or `node:crypto` (Node tests).

## Status

In active development. The parser is built test-driven against the real MapleRoyals v83 (GMS-encryption) fixtures already present at `apps/web/test/fixtures/local/`. See `/Users/nicholasthomson/.claude/plans/loading-map-wz-files-is-eager-forest.md` for the staged plan.

`@tybys/wz` is a transient `devDependency` here, used only as a byte-equality oracle in real-fixture tests. It is removed once parity is achieved.

## References

- Format: https://github.com/lastbattle/Harepacker-resurrected/tree/master/docs/wz-format
