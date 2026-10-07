import type { Meta, StoryObj } from '@storybook/react';
import { StatTile } from '../../src/components/entity/StatTile';

const meta = {
  title: 'Entity/StatTile',
  component: StatTile,
  tags: ['autodocs'],
  args: { label: 'HP', value: '7,800', color: 'var(--stat-hp)', variant: 'soft' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['soft', 'pill'] },
    color: {
      control: 'select',
      options: [
        'var(--stat-hp)',
        'var(--stat-mp)',
        'var(--stat-exp)',
        'var(--stat-level)',
        'var(--text-2)',
      ],
    },
  },
} satisfies Meta<typeof StatTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Soft: Story = {};
export const Pill: Story = {
  args: { variant: 'pill', label: 'MP', value: '150', color: 'var(--stat-mp)' },
  decorators: [
    (Story) => (
      <div style={{ width: 250 }}>
        <Story />
      </div>
    ),
  ],
};
export const StatGrid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 110px)', gap: 6 }}>
      <StatTile label="LVL" value="45" color="var(--stat-level)" />
      <StatTile label="HP" value="7,800" color="var(--stat-hp)" />
      <StatTile label="MP" value="150" color="var(--stat-mp)" />
      <StatTile label="EXP" value="1,056" color="var(--stat-exp)" />
    </div>
  ),
};
