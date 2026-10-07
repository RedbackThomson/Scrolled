import type { Meta, StoryObj } from '@storybook/react';
import { ArrowDownUp, Map as MapIcon, Package, Skull } from 'lucide-react';
import { SectionHeader } from '../../src/components/surfaces/SectionHeader';
import { Button } from '../../src/components/core/Button';

const ICONS = { none: undefined, package: Package, skull: Skull, map: MapIcon };

const meta = {
  title: 'Surfaces/SectionHeader',
  component: SectionHeader,
  tags: ['autodocs'],
  args: { title: 'Drops', icon: Package, count: 35, level: 2 },
  argTypes: {
    level: { control: 'inline-radio', options: [1, 2] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SectionHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Section: Story = {};
export const PageTitle: Story = {
  args: { level: 1, title: 'Frost Wisp', icon: undefined, count: undefined },
};
export const WithSort: Story = {
  args: {
    action: (
      <Button variant="secondary" size="sm" icon={ArrowDownUp}>
        Sort
      </Button>
    ),
  },
};
export const WithLink: Story = {
  args: {
    title: 'Pinned',
    icon: undefined,
    count: undefined,
    action: <a href="#">All collections →</a>,
  },
};
