import type { Meta, StoryObj } from '@storybook/react';
import { HoverPopover } from '../../src/components/overlays/HoverPopover';

const meta = {
  title: 'Overlays/HoverPopover',
  component: HoverPopover,
  tags: ['autodocs'],
  args: {
    children: (
      <a href="#" style={{ fontWeight: 700, color: 'var(--accent-text)' }}>
        Hover or focus me
      </a>
    ),
    content: (
      <div style={{ font: '13px var(--font-body)', maxWidth: 220 }}>
        <b>Hover card</b>
        <div style={{ color: 'var(--text-2)' }}>
          Grows in from the trigger after the hover delay and hides instantly.
        </div>
      </div>
    ),
    align: 'start',
  },
  argTypes: { align: { control: 'inline-radio', options: ['start', 'end'] } },
  decorators: [
    (Story) => (
      <div style={{ padding: '24px 24px 160px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HoverPopover>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AlignEnd: Story = {
  args: { align: 'end' },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Story />
      </div>
    ),
  ],
};
