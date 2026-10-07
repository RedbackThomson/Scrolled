import type { Preview } from '@storybook/react';
import '../src/styles/styles.css';
import { Stage, type Globals } from './Stage';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color mode',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: ['light', 'dark', 'side-by-side'],
        dynamicTitle: true,
      },
    },
    accent: {
      description: 'Accent',
      toolbar: {
        title: 'Accent',
        icon: 'paintbrush',
        items: ['green', 'blue', 'violet', 'rose', 'amber', 'teal'],
        dynamicTitle: true,
      },
    },
    motion: {
      description: 'Interface motion',
      toolbar: { title: 'Motion', icon: 'lightning', items: ['on', 'off'], dynamicTitle: true },
    },
    backdrop: {
      description: 'Page backdrop',
      toolbar: {
        title: 'Backdrop',
        icon: 'photo',
        items: ['sky', 'clouds', 'card'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', accent: 'green', motion: 'on', backdrop: 'sky' },
  decorators: [
    (Story, ctx) => (
      <Stage globals={ctx.globals as Globals} padded={ctx.parameters.layout !== 'fullscreen'}>
        <Story />
      </Stage>
    ),
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true, matchers: { color: /(background|color)$/i } },
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: [
          'Foundations',
          'Core',
          'Forms',
          'Entity',
          'Surfaces',
          'Navigation',
          'Overlays',
          'Data',
          'Feedback',
          'Brand',
          'Screens',
        ],
      },
    },
  },
};

export default preview;
