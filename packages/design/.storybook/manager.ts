import { addons } from '@storybook/manager-api';
import { create } from '@storybook/theming/create';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'Scrolled',
    brandImage: '/assets/logo/scrolled-mark.svg',
    fontBase: 'Figtree, system-ui, sans-serif',
    colorPrimary: '#3fa65a',
    colorSecondary: '#3f86cf',
    appBg: '#f5faff',
    appContentBg: '#ffffff',
    appBorderColor: '#d2e2f1',
    appBorderRadius: 12,
    textColor: '#1c2a48',
    barBg: '#f3f8fd',
  }),
});
