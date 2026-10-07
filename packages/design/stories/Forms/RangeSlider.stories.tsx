import type { Meta, StoryObj } from '@storybook/react';
import { RangeSlider } from '../../src/components/forms/RangeSlider';

const meta = {
  title: 'Forms/RangeSlider',
  component: RangeSlider,
  tags: ['autodocs'],
  args: { min: 0, max: 200, value: [30, 50] },
  argTypes: {},
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RangeSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReqLevel: Story = {};
export const WideRange: Story = { args: { value: [10, 160] } };
