import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FacetPill } from '../../src/components/data/FacetPill';

const meta = {
  title: 'Data/FacetPill',
  component: FacetPill,
  tags: ['autodocs'],
  args: { label: 'Req Lvl', hue: 148, open: false },
  argTypes: {
    hue: { control: { type: 'range', min: 0, max: 360 } },
    onClick: { action: 'open' },
  },
} satisfies Meta<typeof FacetPill>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Open: Story = { args: { open: true } };
export const Active: Story = { args: { valueLabel: '30 – 50' } };
export const ActiveOpen: Story = { args: { valueLabel: '30 – 50', open: true } };
export const Row: Story = {
  render: function Render() {
    const [open, setOpen] = useState<string | null>('Req Lvl');
    const pills: [string, number, string?][] = [
      ['Type', 235, 'Claw'],
      ['Class', 300, 'Thief'],
      ['Req Lvl', 148],
      ['ATK', 185],
      ['Element', 35],
    ];
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {pills.map(([label, hue, value]) => (
          <FacetPill
            key={label}
            label={label}
            hue={hue}
            valueLabel={value}
            open={open === label}
            onClick={() => setOpen(open === label ? null : label)}
          />
        ))}
      </div>
    );
  },
};
export const Large: Story = {
  args: { size: 'lg', valueLabel: 'Claw', label: 'Type', hue: 235 },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
