import type { Meta, StoryObj } from '@storybook/react';
import { Kbd } from '../../src/components/core/Kbd';

const meta = {
  title: 'Core/Kbd',
  component: Kbd,
  tags: ['autodocs'],
  args: { children: '⌘K' },
  argTypes: {},
} satisfies Meta<typeof Kbd>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const PaletteFooter: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-2)' }}>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>navigate
      </span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Kbd>↵</Kbd>select
      </span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Kbd>esc</Kbd>close
      </span>
    </div>
  ),
};
