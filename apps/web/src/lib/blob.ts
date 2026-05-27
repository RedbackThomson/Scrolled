/**
 * Wrap raw bytes in a Blob and return an object URL. Callers own the URL's
 * lifetime and must `URL.revokeObjectURL` it when done. The `BlobPart` cast
 * is centralized here — recent lib.dom types narrow `BlobPart` in a way that
 * rejects a bare `Uint8Array` at the call site.
 */
export function bytesToUrl(bytes: Uint8Array, mime: string): string {
  return URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }));
}
