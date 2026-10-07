import type { Meta, StoryObj } from '@storybook/react';
import { Logo } from '../../src/components/brand/Logo';

const meta = {
  title: 'Brand/Logo',
  component: Logo,
  tags: ['autodocs'],
  args: { size: 34, wordmark: true, subtitle: 'Example dataset' },
  argTypes: { size: { control: { type: 'range', min: 14, max: 160 } } },
} satisfies Meta<typeof Logo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Lockup: Story = {};
export const MarkOnly: Story = { args: { size: 96, wordmark: false, shadow: true } };
export const FaviconSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
      {[96, 48, 32, 24, 16].map((s) => (
        <Logo key={s} size={s} wordmark={false} />
      ))}
    </div>
  ),
};
