import type { Config } from 'tailwindcss';
import preset from '@scrolled/ui/tailwind-preset';

const config: Config = {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};

export default config;
