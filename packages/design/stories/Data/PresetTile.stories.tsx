import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Coins, Crown, Flame, Layers, PartyPopper, Sparkles } from 'lucide-react';
import { PresetTile } from '../../src/components/data/PresetTile';
import { SAMPLE_PRESETS } from '../samplePresets';

const ICONS = {
  flame: Flame,
  sparkles: Sparkles,
  layers: Layers,
  'party-popper': PartyPopper,
  coins: Coins,
  crown: Crown,
};

const meta = {
  title: 'Data/PresetTile',
  component: PresetTile,
  tags: ['autodocs'],
  args: { icon: Flame, label: 'Highest ATK', count: 24, hue: 22, active: false },
  argTypes: {
    hue: { control: { type: 'range', min: 0, max: 360 } },
    onClick: { action: 'select' },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 190 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PresetTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Active: Story = { args: { active: true } };
export const Compact: Story = { args: { compact: true } };
export const Shelf: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 1000 }}>
        <Story />
      </div>
    ),
  ],
  render: function Render() {
    const [active, setActive] = useState(0);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0,1fr))', gap: 10 }}>
        {SAMPLE_PRESETS.map(([icon, label, count, hue], k) => (
          <PresetTile
            key={label}
            icon={icon}
            label={label}
            count={count}
            hue={hue}
            active={active === k}
            onClick={() => setActive(k)}
          />
        ))}
      </div>
    );
  },
};
