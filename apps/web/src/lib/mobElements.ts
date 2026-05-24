// `info/elemAttr` in Mob.wz is a flat string like "I2F3" — pairs of element
// code + level. Level 1 = immune, 2 = resistant, 3 = weak. Anything not
// listed is neutral.

export type ElementStatus = 'neutral' | 'immune' | 'resistant' | 'weak';

export const ELEMENT_NAMES = {
  I: 'Ice',
  L: 'Lightning',
  F: 'Fire',
  S: 'Poison',
  H: 'Holy',
  D: 'Dark',
  P: 'Physical',
} as const;

export type ElementName = (typeof ELEMENT_NAMES)[keyof typeof ELEMENT_NAMES];

const STATUS_BY_LEVEL = {
  '1': 'immune',
  '2': 'resistant',
  '3': 'weak',
} as const;

export const ELEMENT_ORDER: readonly ElementName[] = Object.values(ELEMENT_NAMES);

export function parseMobElements(element?: string | null): Record<ElementName, ElementStatus> {
  const result = {} as Record<ElementName, ElementStatus>;
  for (const name of ELEMENT_ORDER) result[name] = 'neutral';
  if (!element) return result;
  for (const [, code, level] of element.matchAll(/([ILFSHDP])([123])/g)) {
    result[ELEMENT_NAMES[code as keyof typeof ELEMENT_NAMES]] =
      STATUS_BY_LEVEL[level as keyof typeof STATUS_BY_LEVEL];
  }
  return result;
}
