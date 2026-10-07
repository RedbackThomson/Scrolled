import type { Meta, StoryObj } from '@storybook/react';
import { Scrolly } from '../../src/components/brand/Scrolly';

const POSES = ['idle', 'wave', 'read', 'sleepy', 'cheer'] as const;

const meta = {
  title: 'Brand/Scrolly',
  component: Scrolly,
  tags: ['autodocs'],
  args: { pose: 'idle', size: 120, animate: true },
  argTypes: {
    pose: { control: 'inline-radio', options: POSES },
    size: { control: { type: 'range', min: 40, max: 240 } },
  },
} satisfies Meta<typeof Scrolly>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = { args: { pose: 'idle' } };
export const Wave: Story = { args: { pose: 'wave' } };
export const Read: Story = { args: { pose: 'read' } };
export const Sleepy: Story = { args: { pose: 'sleepy' } };
export const Cheer: Story = { args: { pose: 'cheer' } };
export const AllPoses: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
      {POSES.map((p) => (
        <div key={p} style={{ textAlign: 'center' }}>
          <Scrolly pose={p} size={90} />
          <div style={{ font: 'var(--type-meta)', color: 'var(--text-2)', marginTop: 6 }}>{p}</div>
        </div>
      ))}
    </div>
  ),
};
export const Still: Story = { args: { animate: false } };
