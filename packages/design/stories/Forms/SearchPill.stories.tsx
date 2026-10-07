import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SearchPill } from '../../src/components/forms/SearchPill';

const meta = {
  title: 'Forms/SearchPill',
  component: SearchPill,
  tags: ['autodocs'],
  args: { placeholder: 'Search or jump to…', shortcut: '⌘K', width: 520, tone: 'float' },
  argTypes: {
    tone: { control: 'inline-radio', options: ['float', 'sunken'] },
    onClick: { action: 'open palette' },
  },
} satisfies Meta<typeof SearchPill>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TopBar: Story = {};
export const WithValue: Story = { args: { value: 'Frost Wisp' } };
export const InPopover: Story = {
  args: { tone: 'sunken', placeholder: 'Find a collection…', shortcut: null, width: 300 },
};

function FieldDemo() {
  const [value, setValue] = useState('');
  return (
    <SearchPill
      tone="sunken"
      size="md"
      width={280}
      placeholder="Search maps…"
      aria-label="Search maps"
      value={value}
      onChange={setValue}
    />
  );
}
/** With `onChange` the pill is a real search field, with a clear button once there's text. */
export const AsField: Story = { render: () => <FieldDemo /> };
