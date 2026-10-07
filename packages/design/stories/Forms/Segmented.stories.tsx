import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { LayoutGrid, Table2 } from 'lucide-react';
import { Segmented } from '../../src/components/forms/Segmented';

const meta = {
  title: 'Forms/Segmented',
  component: Segmented,
  tags: ['autodocs'],
  args: {
    value: 'light',
    options: [
      { value: 'light', label: 'Light' },
      { value: 'dark', label: 'Dark' },
    ],
  },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    onChange: { action: 'changed' },
  },
} satisfies Meta<typeof Segmented>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Theme: Story = {};
export const ViewToggle: Story = {
  args: {
    value: 'cards',
    options: [
      { value: 'table', icon: Table2, title: 'Table' },
      { value: 'cards', icon: LayoutGrid, title: 'Cards' },
    ],
  },
};
export const Backdrop: Story = {
  args: {
    value: 'clouds',
    options: [
      { value: 'sky', label: 'Sky' },
      { value: 'clouds', label: 'Sky + clouds' },
    ],
  },
};

function InteractiveDemo() {
  const [value, setValue] = useState('table');
  return (
    <Segmented
      value={value}
      onChange={setValue}
      options={[
        { value: 'table', icon: Table2, label: 'Table' },
        { value: 'cards', icon: LayoutGrid, label: 'Cards' },
      ]}
    />
  );
}
export const Interactive: Story = { render: () => <InteractiveDemo /> };
