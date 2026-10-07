import type { Meta, StoryObj } from '@storybook/react';
import { CloudBackdrop } from '../../src/components/surfaces/CloudBackdrop';
import { Panel } from '../../src/components/surfaces/Panel';

const meta = {
  title: 'Surfaces/CloudBackdrop',
  component: CloudBackdrop,
  tags: ['autodocs'],
  args: { animate: true, count: 6 },
  argTypes: { count: { control: { type: 'range', min: 1, max: 6 } } },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          height: 480,
          background: 'var(--gradient-page)',
          overflow: 'hidden',
        }}
      >
        <Story />
        <div style={{ position: 'absolute', right: 24, bottom: 24 }}>
          <Panel>Cards sit above the clouds</Panel>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof CloudBackdrop>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Drifting: Story = {};
export const Paused: Story = { args: { animate: false } };
export const Sparse: Story = { args: { count: 3 } };
