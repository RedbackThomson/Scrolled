import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// The color variables come from @scrolled/design's tokens.css and hold finished
// colors (hex/oklch), so opacity modifiers like `bg-muted/40` go through
// color-mix rather than the `hsl(var(--x) / a)` channel trick.
const mix = (color: string) =>
  `color-mix(in oklab, ${color} calc(<alpha-value> * 100%), transparent)`;
const token = (name: string) => mix(`var(${name})`);

const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: token('--border-1'),
        input: token('--border-1'),
        ring: token('--accent'),
        background: token('--surface-page'),
        foreground: token('--text-1'),
        primary: {
          DEFAULT: token('--accent'),
          foreground: token('--accent-fg'),
        },
        secondary: {
          DEFAULT: token('--surface-sunken'),
          foreground: token('--text-1'),
        },
        destructive: {
          DEFAULT: token('--danger'),
          foreground: mix('#fff'),
        },
        muted: {
          DEFAULT: token('--surface-sunken'),
          foreground: token('--text-2'),
        },
        accent: {
          DEFAULT: token('--surface-row-hover'),
          foreground: token('--text-1'),
        },
        card: {
          DEFAULT: token('--surface-card'),
          foreground: token('--text-1'),
        },
        sidebar: {
          DEFAULT: token('--surface-sidebar'),
          foreground: token('--text-1'),
          muted: token('--text-2'),
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
      },
      boxShadow: {
        rim: 'var(--shadow-rim)',
        float: 'var(--shadow-float)',
        pop: 'var(--shadow-pop)',
        slot: 'var(--shadow-slot)',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Fredoka', 'Figtree', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [animate],
};

export default preset;
