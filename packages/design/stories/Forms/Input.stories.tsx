import type { Meta, StoryObj } from '@storybook/react';
import { Input, Textarea } from '../../src/components/forms/Input';

const meta = {
  title: 'Forms/Input',
  component: Input,
  tags: ['autodocs'],
  args: { placeholder: 'Collection name', disabled: false },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Input>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true, value: 'Read only' } };
export const Multiline: Story = {
  render: () => <Textarea placeholder="Optional description" rows={3} />,
};
