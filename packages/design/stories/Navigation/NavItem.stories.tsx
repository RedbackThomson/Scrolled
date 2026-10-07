import type { Meta, StoryObj } from '@storybook/react';
import { ExternalLink, House, Package, Palette, Skull } from 'lucide-react';
import { NavItem } from '../../src/components/navigation/NavItem';

const ICONS = { none: undefined, skull: Skull, package: Package, palette: Palette, house: House };

const meta = {
  title: 'Navigation/NavItem',
  component: NavItem,
  tags: ['autodocs'],
  args: { icon: Skull, label: 'Mobs', active: false },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    indicator: { control: 'inline-radio', options: ['pill', 'none'] },
    onClick: { action: 'clicked' },
    onToggle: { action: 'toggled' },
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
export const WithChildren: Story = {
  args: { icon: Package, label: 'Items', expanded: true, controls: 'items-children' },
};
export const Child: Story = {
  args: { size: 'sm', icon: Palette, label: 'Look & feel', active: true },
};
export const Collapsed: Story = { args: { collapsed: true, active: true } };
/** `renderLink` swaps the button for a router or external link. */
export const ExternalLinkRow: Story = {
  args: {
    icon: House,
    label: 'Navigator',
    trailing: <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />,
    renderLink: (props) => <a href="#navigator" {...props} />,
  },
};
