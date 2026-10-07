import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge the preset's custom utilities so a caller's
// `shadow-none` or `ease-out` replaces them instead of stacking.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: ['rim', 'float', 'pop', 'slot'] }],
      ease: [{ ease: ['spring'] }],
      'font-family': [{ font: ['display'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
