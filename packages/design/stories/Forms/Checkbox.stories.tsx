import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Checkbox } from '../../src/components/forms/Checkbox';

const meta = {
  title: 'Forms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  args: { label: 'Thief', checked: true },
  argTypes: { onChange: { action: 'changed' } },
} satisfies Meta<typeof Checkbox>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Checked: Story = {};
export const Unchecked: Story = { args: { checked: false, label: 'Pirate' } };

function InteractiveDemo() {
  const [selected, setSelected] = useState(['Thief']);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {['Beginner', 'Warrior', 'Magician', 'Bowman', 'Thief', 'Pirate'].map((c) => (
        <Checkbox
          key={c}
          label={c}
          checked={selected.includes(c)}
          onChange={(v) => setSelected((x) => (v ? [...x, c] : x.filter((y) => y !== c)))}
        />
      ))}
    </div>
  );
}
export const Interactive: Story = { render: () => <InteractiveDemo /> };
