import { SwatchPicker } from '@scrolled/design';
import { ACCENTS, isAccentName } from '@/lib/accents';
import { useAccent } from '@/stores/accent';

const OPTIONS = ACCENTS.map((a) => ({ value: a.name, color: a.swatch, label: a.label }));

/**
 * Row of accent swatches. Reads and writes the accent store directly, so it
 * needs no props and can drop into Settings, the wizard, or anywhere else.
 */
export function AccentPicker() {
  const accent = useAccent((s) => s.accent);
  const setAccent = useAccent((s) => s.setAccent);
  return (
    <SwatchPicker
      options={OPTIONS}
      value={accent}
      onChange={(v) => isAccentName(v) && setAccent(v)}
    />
  );
}
