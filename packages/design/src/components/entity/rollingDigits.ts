/** Only plain numerals (with grouping or decimal separators) roll; anything else renders as-is. */
export function isRollable(text: string): boolean {
  return /^[\d,.\s]+$/.test(text) && /\d/.test(text);
}

export type RollingChar = { kind: 'digit'; digit: number } | { kind: 'static'; char: string };

export function splitDigits(text: string): RollingChar[] {
  return [...text].map((char) =>
    /\d/.test(char) ? { kind: 'digit', digit: Number(char) } : { kind: 'static', char },
  );
}
