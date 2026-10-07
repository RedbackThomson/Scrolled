import type { Meta, StoryObj } from '@storybook/react';
import { TopBar } from '../../src/components/navigation/TopBar';

const meta = {
  title: 'Navigation/TopBar',
  component: TopBar,
  tags: ['autodocs'],
  args: {},
  argTypes: { onSearch: { action: 'open palette' }, onTheme: { action: 'toggle theme' } },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TopBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
