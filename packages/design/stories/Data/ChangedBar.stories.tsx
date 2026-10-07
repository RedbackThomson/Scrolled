import type { Meta, StoryObj } from '@storybook/react';
import { ChangedBar } from '../../src/components/data/ChangedBar';

const meta = {
  title: 'Data/ChangedBar',
  component: ChangedBar,
  tags: ['autodocs'],
  args: { onRevert: () => {}, onUpdate: () => {} },
  argTypes: { onRevert: { action: 'revert' }, onUpdate: { action: 'update' } },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 358 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChangedBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Updating: Story = { args: { updating: true } };
