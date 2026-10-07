import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { CircleUser, House, Library, Palette, Settings, Skull, Wrench } from 'lucide-react';
import { Sidebar } from '../../src/components/navigation/Sidebar';
import { SAMPLE_NAV } from '../sampleNav';

const meta = {
  title: 'Navigation/Sidebar',
  component: Sidebar,
  tags: ['autodocs'],
  args: {
    items: SAMPLE_NAV,
    active: 'mobs',
    subtitle: 'Example dataset',
    status: 'ok',
    statusLabel: 'Database OK',
  },
  argTypes: {
    items: { control: false },
    active: {
      control: 'select',
      options: [
        'home',
        'items',
        'equips',
        'weapons',
        'mobs',
        'npcs',
        'maps',
        'quests',
        'skills',
        'collections',
      ],
    },
    status: { control: 'inline-radio', options: ['ok', 'offline', 'warn', 'danger'] },
    onSelect: { action: 'navigate' },
  },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: 640, display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Interactive: Story = {
  render: function Render(args) {
    const [active, setActive] = useState('home');
    return <Sidebar {...args} active={active} onSelect={setActive} />;
  },
};
export const Offline: Story = { args: { status: 'offline', statusLabel: 'Offline mode' } };
export const SettingsExpanded: Story = {
  args: {
    active: 'settings',
    items: [
      { key: 'home', icon: House, label: 'Home' },
      { key: 'mobs', icon: Skull, label: 'Mobs' },
      {
        key: 'settings',
        icon: Settings,
        label: 'Settings',
        children: [
          { key: 'l', icon: Library, label: 'Library' },
          { key: 'f', icon: Palette, label: 'Look & feel', active: true },
          { key: 'a', icon: CircleUser, label: 'Account' },
          { key: 'x', icon: Wrench, label: 'Advanced' },
        ],
      },
    ],
  },
};
