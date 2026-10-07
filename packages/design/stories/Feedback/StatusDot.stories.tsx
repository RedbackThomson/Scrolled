import type { Meta, StoryObj } from '@storybook/react';
import { StatusDot } from '../../src/components/feedback/StatusDot';

const meta = {
  title: 'Feedback/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
  args: { status: 'ok', label: 'Database OK' },
  argTypes: { status: { control: 'inline-radio', options: ['ok', 'offline', 'warn', 'danger'] } },
} satisfies Meta<typeof StatusDot>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OK: Story = {};
export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <StatusDot label="Database OK" />
      <StatusDot status="offline" label="Offline mode" />
      <StatusDot status="warn" label="Refresh library" />
      <StatusDot status="danger" label="Update needed" />
    </div>
  ),
};
