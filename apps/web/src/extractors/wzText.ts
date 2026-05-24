// Normalization for human-readable text pulled from `String.wz`.
//
// WZ files store descriptions with literal C-style escape sequences — a
// two-character `\` + `n` rather than a real LF — because most editors that
// produce WZ data write text out unescaped. The DB stores text post-
// normalization so consumers (detail pages, hover cards, exports) don't
// each have to undo the escapes at render time.

/**
 * Convert C-style escape sequences (`\n`, `\r`, `\t`, `\\`) embedded in a
 * WZ string into their real characters. Walks the input in a single pass
 * so that `\\n` (a literal backslash followed by `n`) round-trips to a
 * backslash plus `n` instead of collapsing to a newline.
 *
 * Returns `null` / empty input unchanged.
 */
export function unescapeWzString(input: string | null): string | null;
export function unescapeWzString(input: string): string;
export function unescapeWzString(input: string | null): string | null {
  if (input === null || input.length === 0) return input;
  if (input.indexOf('\\') === -1) return input;

  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\' && i + 1 < input.length) {
      const next = input[i + 1];
      if (next === 'n') {
        out += '\n';
        i += 1;
        continue;
      }
      if (next === 'r') {
        out += '\r';
        i += 1;
        continue;
      }
      if (next === 't') {
        out += '\t';
        i += 1;
        continue;
      }
      if (next === '\\') {
        out += '\\';
        i += 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}
