import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from '../../src/components/navigation/Breadcrumb';

const meta = {
  title: 'Navigation/Breadcrumb',
  component: Breadcrumb,
  tags: ['autodocs'],
  args: { items: [{ label: 'Settings' }, { label: 'Look & feel' }] },
  argTypes: {},
} satisfies Meta<typeof Breadcrumb>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = {};
export const WorldMap: Story = {
  args: { items: [{ label: 'World' }, { label: 'Northern Isles' }, { label: 'Harbor Town' }] },
};
