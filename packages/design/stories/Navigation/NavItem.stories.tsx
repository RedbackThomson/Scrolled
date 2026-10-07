import type { Meta, StoryObj } from '@storybook/react';
import { House, Package, Palette, Skull } from 'lucide-react';
import { NavItem } from '../../src/components/navigation/NavItem';

const ICONS = { none: undefined, skull: Skull, package: Package, palette: Palette, house: House };

const meta = {
  title: 'Navigation/NavItem',
  component: NavItem,
  tags: ['autodocs'],
  args: { icon: Skull, label: 'Mobs', active: false },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    onClick: { action: 'clicked' },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 210 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NavItem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {};
export const Active: Story = { args: { active: true } };
export const WithChevron: Story = { args: { icon: Package, label: 'Items', chevron: true } };
export const Child: Story = {
  args: { size: 'sm', icon: Palette, label: 'Look & feel', active: true },
};
