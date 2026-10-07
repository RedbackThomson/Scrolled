import type { Meta, StoryObj } from '@storybook/react';
import { Crown, Repeat } from 'lucide-react';
import { Chip } from '../../src/components/core/Chip';

const ICONS = { none: undefined, crown: Crown, repeat: Repeat };

const meta = {
  title: 'Core/Chip',
  component: Chip,
  tags: ['autodocs'],
  args: { children: 'Boss', tone: 'gold', icon: Crown },
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'accent', 'gold', 'danger', 'ok', 'hue'] },
    hue: { control: { type: 'range', min: 0, max: 360 } },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    onRemove: { action: 'removed' },
  },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Boss: Story = {};
export const Neutral: Story = { args: { tone: 'neutral', icon: undefined, children: 'In-game' } };
export const EntityHue: Story = {
  args: { tone: 'hue', hue: 235, icon: undefined, children: 'Claw' },
};
export const Danger: Story = {
  args: { tone: 'danger', icon: undefined, children: 'Update needed' },
};
export const Removable: Story = { args: { tone: 'neutral', icon: undefined, children: 'Thief' } };
export const AllTones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <Chip tone="gold" icon={Crown}>
        Boss
      </Chip>
      <Chip>In-game</Chip>
      <Chip tone="accent">Selected</Chip>
      <Chip tone="ok" icon={Repeat}>
        Tradeable
      </Chip>
      <Chip tone="danger">Update needed</Chip>
      {[70, 235, 20, 150, 185, 295].map((h) => (
        <Chip key={h} tone="hue" hue={h}>
          hue {h}
        </Chip>
      ))}
    </div>
  ),
};
