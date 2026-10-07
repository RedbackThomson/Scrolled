import type { Config } from 'tailwindcss';
import preset from './src/tailwind-preset';

// Only Storybook builds with this config; apps run their own Tailwind over
// this package's sources through the shared preset.
const config: Config = {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', './stories/**/*.{ts,tsx,mdx}', './.storybook/**/*.tsx'],
};

export default config;
