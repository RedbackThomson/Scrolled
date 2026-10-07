import type { Meta, StoryObj } from '@storybook/react';
import { TextField } from '../../src/components/forms/TextField';

const meta = {
  title: 'Forms/TextField',
  component: TextField,
  tags: ['autodocs'],
  args: { label: 'Name', placeholder: 'e.g. Boss drops to farm' },
  argTypes: { onChange: { action: 'changed' } },
  decorators: [
    (Story) => (
      <div style={{ width: 380 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Filled: Story = { args: { value: 'Boss drops to farm' } };
export const Focused: Story = { args: { value: 'Boss drops', focused: true } };
export const Multiline: Story = {
  args: {
    label: 'Description',
    hint: 'Optional',
    multiline: true,
    placeholder: "What's this collection for? (multi-line)",
  },
};
export const Error: Story = { args: { value: '', error: 'Name is required.' } };
