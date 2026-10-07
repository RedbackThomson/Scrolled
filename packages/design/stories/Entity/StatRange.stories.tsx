import type { Meta, StoryObj } from '@storybook/react';
import { StatRange } from '../../src/components/entity/StatRange';

const meta = {
  title: 'Entity/StatRange',
  component: StatRange,
  tags: ['autodocs'],
  args: { label: 'Attack', base: 24, min: 19, max: 29 },
  argTypes: {
    color: {
      control: 'select',
      options: [
        'var(--stat-hp)',
        'var(--stat-mp)',
        'var(--stat-exp)',
        'var(--el-dark)',
        'var(--text-2)',
      ],
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatRange>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Attack: Story = {};
export const EquipStats: Story = {
  render: () => (
    <div style={{ width: 300 }}>
      <StatRange label="Attack" base={24} min={19} max={29} />
      <StatRange label="LUK" base={3} min={0} max={6} color="var(--el-dark)" scaleMax={10} />
      <StatRange label="Avoid" base={2} min={0} max={5} color="var(--text-2)" scaleMax={10} />
    </div>
  ),
};
