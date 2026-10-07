import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Switch } from '../../src/components/forms/Switch';

const meta = {
  title: 'Forms/Switch',
  component: Switch,
  tags: ['autodocs'],
  args: { checked: true },
  argTypes: { onChange: { action: 'toggled' } },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const On: Story = {};
export const Off: Story = { args: { checked: false } };
export const SettingsRow: Story = {
  args: { label: 'Drifting clouds', description: 'Clouds float slowly across the backdrop.' },
  decorators: [
    (Story) => (
      <div style={{ width: 520 }}>
        <Story />
      </div>
    ),
  ],
};

function InteractiveDemo() {
  const [on, setOn] = useState(true);
  return (
    <Switch
      label="Interface motion"
      description="Springy hover, pop-in tooltips and page transitions."
      checked={on}
      onChange={setOn}
    />
  );
}
export const Interactive: Story = { render: () => <InteractiveDemo /> };
