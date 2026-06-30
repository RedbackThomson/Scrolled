import type { Config } from 'tailwindcss';
import preset from '@scrolled/ui/tailwind-preset';

const config: Config = {
  presets: [preset],
  // The shared @scrolled/ui primitives (Button, Dialog, Command, etc.) reference
  // utility classes that don't otherwise appear in this app's small source. Scan
  // the package directly so its `inline-flex`, `fixed inset-0`, `translate-*`,
  // and friends are actually emitted into the bundle.
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
