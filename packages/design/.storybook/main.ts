import type { StorybookConfig } from '@storybook/react-vite';

const allowedHosts = [
  ...(process.env.DEV_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
];

const config: StorybookConfig = {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  staticDirs: [{ from: '../assets', to: '/assets' }],
  docs: { autodocs: 'tag' },
  // Storybook's dev server rejects unknown hosts before Vite sees the request, so both need the list.
  core: { allowedHosts },
  async viteFinal(config) {
    config.server ??= {};
    config.server.allowedHosts = allowedHosts;
    return config;
  },
};

export default config;
