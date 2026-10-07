import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Search, X } from 'lucide-react';
import { Kbd } from '../../src/components/core/Kbd';
import { TextArea, TextField } from '../../src/components/forms/TextField';

const meta = {
  title: 'Forms/TextField',
  component: TextField,
  tags: ['autodocs'],
  args: { label: 'Name', placeholder: 'e.g. Boss drops to farm' },
  argTypes: {
    onChange: { action: 'changed' },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    variant: { control: 'inline-radio', options: ['default', 'ghost', 'float', 'sunken'] },
    shape: { control: 'inline-radio', options: ['rounded', 'pill'] },
  },
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
export const Filled: Story = { args: { defaultValue: 'Boss drops to farm' } };
export const Focused: Story = { args: { defaultValue: 'Boss drops', focused: true } };
export const Error: Story = { args: { error: 'Name is required.' } };
export const WithHint: Story = { args: { hint: 'Optional' } };
export const WithIcon: Story = {
  args: { label: undefined, icon: Search, placeholder: 'Find class…' },
};
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TextField {...args} label={undefined} size="sm" placeholder="Small, 28px" />
      <TextField {...args} label={undefined} size="md" placeholder="Medium, 38px" />
      <TextField {...args} label={undefined} size="lg" placeholder="Large, 48px for touch" />
    </div>
  ),
};
export const Numeric: Story = {
  args: { label: undefined, type: 'number', placeholder: 'Qty', size: 'sm', style: { width: 64 } },
};
export const Mono: Story = {
  args: { label: 'Bridge URL', mono: true, placeholder: 'ws://localhost:8765' },
};
/** Borderless until hovered or focused, for renaming in place. */
export const Ghost: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('Thief claws 30–50');
    return (
      <TextField
        {...args}
        label={undefined}
        variant="ghost"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Name"
      />
    );
  },
};
export const Multiline: Story = {
  render: () => (
    <TextArea
      label="Description"
      hint="Optional"
      placeholder="What's this collection for?"
      rows={3}
    />
  ),
};

/** Pill fields on the page backdrop and inside a popover, with a keycap and a clear button. */
export const Pills: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <TextField
        variant="float"
        shape="pill"
        icon={Search}
        placeholder="Search or jump to…"
        aria-label="Search"
        trailing={<Kbd>/</Kbd>}
      />
      <TextField
        variant="sunken"
        shape="pill"
        icon={Search}
        defaultValue="Frost"
        aria-label="Find a collection"
        trailing={<X size={13} color="var(--text-2)" />}
      />
    </div>
  ),
};
/** A tag before the value, as in the range slider's bounds. */
export const WithLeading: Story = {
  args: {
    label: undefined,
    leading: <span style={{ font: '700 11px var(--font-body)', color: 'var(--text-2)' }}>MIN</span>,
    defaultValue: '30',
    inputMode: 'numeric',
    inputClassName: 'text-right font-bold',
  },
};
