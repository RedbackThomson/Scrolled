// Canonical vocabulary for the status ailments the game models (curse,
// darkness, poison, …). The single place that knows the WZ single-letter codes.
// Consumed by consumable monster-card resistances (`defenseState`) and cure
// flags; kept separate from elements (see `mobElements.ts`) since ailments and
// elemental attributes are different concepts that happen to share a few names.

export const STATUS_AILMENT_NAMES = {
  C: 'Curse',
  D: 'Darkness',
  P: 'Poison',
  S: 'Seal',
  W: 'Weakness',
  F: 'Freeze',
} as const;

export type StatusAilmentCode = keyof typeof STATUS_AILMENT_NAMES;

/** Decode a single-letter ailment code; unknown codes round-trip unchanged. */
export function decodeStatusAilment(code: string): string {
  return STATUS_AILMENT_NAMES[code as StatusAilmentCode] ?? code;
}
