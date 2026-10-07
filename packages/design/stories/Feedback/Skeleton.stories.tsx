import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from '../../src/components/feedback/Skeleton';

const meta = {
  title: 'Feedback/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  args: { rows: 4 },
  argTypes: { rows: { control: { type: 'range', min: 1, max: 10 } } },
  decorators: [
    (Story) => (
      <div style={{ width: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Skeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {};
export const Single: Story = { args: { rows: 1 } };
