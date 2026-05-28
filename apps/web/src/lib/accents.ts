// The accent is the color used for primary buttons, links, active states, and
// focus rings — the `--primary` / `--ring` CSS variables. The actual color
// values (light + dark, per accent) live in `styles/index.css` under
// `[data-accent='…']` selectors; this registry just names the options and
// carries a swatch color so the picker can render a dot without depending on
// the live CSS var.
//
// `swatch` must stay in sync with the light-mode `--primary` value for the same
// accent in `index.css`. That's the one unavoidable duplication — CSS can't
// import this file.

export type AccentName = 'green' | 'blue' | 'violet' | 'rose' | 'amber' | 'teal';

export interface AccentOption {
  name: AccentName;
  label: string;
  /** Light-mode `--primary` as an `hsl(...)` string, for the picker swatch. */
  swatch: string;
}

export const ACCENTS: readonly AccentOption[] = [
  { name: 'green', label: 'Green', swatch: 'hsl(142 72% 36%)' },
  { name: 'blue', label: 'Blue', swatch: 'hsl(221 83% 53%)' },
  { name: 'violet', label: 'Violet', swatch: 'hsl(262 83% 58%)' },
  { name: 'rose', label: 'Rose', swatch: 'hsl(347 77% 50%)' },
  { name: 'amber', label: 'Amber', swatch: 'hsl(25 95% 45%)' },
  { name: 'teal', label: 'Teal', swatch: 'hsl(175 84% 32%)' },
] as const;

export const DEFAULT_ACCENT: AccentName = 'green';

const NAMES = new Set<string>(ACCENTS.map((a) => a.name));

export function isAccentName(v: unknown): v is AccentName {
  return typeof v === 'string' && NAMES.has(v);
}
