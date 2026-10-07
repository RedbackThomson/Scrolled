import type { Meta, StoryObj } from '@storybook/react';
import { InfoRow } from '../../src/components/surfaces/InfoRow';

const meta = {
  title: 'Surfaces/InfoRow',
  component: InfoRow,
  tags: ['autodocs'],
  args: { label: 'Street', value: 'Harbor Road' },
  argTypes: {},
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mono: Story = { args: { label: 'ID', value: '1000001', mono: true } };
export const Last: Story = { args: { last: true } };
