// The accent colors primary buttons, links, active states and focus rings. CSS
// owns the values: `[data-accent]` in @scrolled/design's colors.css sets the
// hue `--accent-h`, and every accent shade derives from it. `swatch` repeats
// the light-mode `--accent` so the picker can draw a dot without the live CSS
// var — keep the hues in sync with colors.css.

export type AccentName = 'green' | 'blue' | 'violet' | 'rose' | 'amber' | 'teal';

export interface AccentOption {
  name: AccentName;
  label: string;
  /** Light-mode `--accent` as an `oklch(...)` string, for the picker swatch. */
  swatch: string;
}

export const ACCENTS: readonly AccentOption[] = [
  { name: 'green', label: 'Green', swatch: 'oklch(0.64 0.17 148)' },
  { name: 'blue', label: 'Blue', swatch: 'oklch(0.64 0.17 255)' },
  { name: 'violet', label: 'Violet', swatch: 'oklch(0.64 0.17 295)' },
  { name: 'rose', label: 'Rose', swatch: 'oklch(0.64 0.17 10)' },
  { name: 'amber', label: 'Amber', swatch: 'oklch(0.64 0.17 60)' },
  { name: 'teal', label: 'Teal', swatch: 'oklch(0.64 0.17 185)' },
] as const;

export const DEFAULT_ACCENT: AccentName = 'green';

const NAMES = new Set<string>(ACCENTS.map((a) => a.name));

export function isAccentName(v: unknown): v is AccentName {
  return typeof v === 'string' && NAMES.has(v);
}
