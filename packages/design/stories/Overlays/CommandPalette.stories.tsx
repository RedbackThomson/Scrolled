import type { Meta, StoryObj } from '@storybook/react';
import { Ghost, Map as MapIcon, ScrollText, Skull } from 'lucide-react';
import { CommandPalette } from '../../src/components/overlays/CommandPalette';

const meta = {
  title: 'Overlays/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  args: {
    query: 'pine',
    selected: 'm1',
    groups: [
      {
        title: 'Recent',
        items: [
          { key: 'm1', label: 'Pine Grove I', meta: 'Map', icon: MapIcon, hue: 185 },
          { key: 'm2', label: 'Pine Grove II', meta: 'Map', icon: MapIcon, hue: 185 },
        ],
      },
      {
        title: 'Results',
        items: [
          { key: 's', label: 'Frost Wisp', meta: 'Mob', icon: Ghost, tint: 'mob' },
          { key: 'q', label: 'Quest name', meta: 'Quest', icon: ScrollText, hue: 295 },
        ],
      },
      { title: 'Go to', items: [{ key: 'g', label: 'Mobs', meta: 'Page', icon: Skull }] },
    ],
  },
  argTypes: {},
} satisfies Meta<typeof CommandPalette>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithQuery: Story = {};
export const Empty: Story = { args: { query: '', groups: [], selected: undefined } };
