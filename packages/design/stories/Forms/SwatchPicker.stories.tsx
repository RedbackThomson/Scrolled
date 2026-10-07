import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SwatchPicker } from '../../src/components/forms/SwatchPicker';

const ACCENTS = (
  [
    ['green', 148],
    ['blue', 255],
    ['violet', 295],
    ['rose', 10],
    ['amber', 60],
    ['teal', 185],
  ] as const
).map(([value, h]) => ({ value, label: value, color: `oklch(0.64 0.17 ${h})` }));
const COLLECTION_COLORS = (
  [
    ['neutral', null],
    ['red', 25],
    ['orange', 50],
    ['amber', 75],
    ['green', 148],
    ['teal', 185],
    ['sky', 230],
    ['indigo', 270],
    ['violet', 295],
    ['pink', 350],
  ] as const
).map(([value, h]) => ({
  value,
  label: value,
  color: h == null ? 'var(--border-1)' : `oklch(0.68 0.16 ${h})`,
}));

const meta = {
  title: 'Forms/SwatchPicker',
  component: SwatchPicker,
  tags: ['autodocs'],
  args: { options: ACCENTS, value: 'green', size: 24 },
  argTypes: { onChange: { action: 'picked' } },
} satisfies Meta<typeof SwatchPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Accent: Story = {};
export const CollectionColor: Story = {
  args: { options: COLLECTION_COLORS, value: 'orange', size: 30 },
};

function InteractiveDemo() {
  const [value, setValue] = useState('violet');
  return <SwatchPicker options={ACCENTS} value={value} onChange={setValue} />;
}
export const Interactive: Story = { render: () => <InteractiveDemo /> };
