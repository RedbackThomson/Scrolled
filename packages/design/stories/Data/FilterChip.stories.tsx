import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FilterChip } from '../../src/components/data/FilterChip';

const meta = {
  title: 'Data/FilterChip',
  component: FilterChip,
  tags: ['autodocs'],
  args: { label: 'Req Lvl', value: '30 – 50', hue: 148 },
  argTypes: {
    hue: { control: { type: 'range', min: 0, max: 360 } },
    onRemove: { action: 'remove' },
    onClick: { action: 'add' },
  },
} satisfies Meta<typeof FilterChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AddChip: Story = { args: { add: true } };
export const Row: Story = {
  render: function Render() {
    const [filters, setFilters] = useState<[string, string, number][]>([
      ['Req Lvl', '30 – 50', 148],
      ['Class', 'Thief', 300],
      ['Weak against', 'Fire', 35],
    ]);
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {filters.map(([label, value, hue]) => (
          <FilterChip
            key={label}
            label={label}
            value={value}
            hue={hue}
            onRemove={() => setFilters((x) => x.filter((y) => y[0] !== label))}
          />
        ))}
        <FilterChip add />
      </div>
    );
  },
};
