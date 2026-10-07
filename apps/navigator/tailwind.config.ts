import type { Config } from 'tailwindcss';
import preset from '@scrolled/design/tailwind-preset';

const config: Config = {
  presets: [preset],
  // The shared @scrolled/design primitives (Button, Dialog, Command, etc.) reference
  // utility classes that don't otherwise appear in this app's small source. Scan
  // the package directly so its `inline-flex`, `fixed inset-0`, `translate-*`,
  // and friends are actually emitted into the bundle.
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../packages/design/src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
