import type { Config } from 'tailwindcss';
import preset from '@scrolled/design/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/design/src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
