import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowDownUp,
  BookmarkPlus,
  Check,
  Crown,
  ListFilter,
  Map as MapIcon,
  MapPin,
  Package,
  Pencil,
  Plus,
  Route,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { IconButton } from '../../src/components/core/IconButton';

const ICONS = {
  'bookmark-plus': BookmarkPlus,
  pencil: Pencil,
  'trash-2': Trash2,
  route: Route,
  'arrow-down-up': ArrowDownUp,
  'list-filter': ListFilter,
  'sliders-horizontal': SlidersHorizontal,
  'map-pin': MapPin,
  x: X,
  sun: Sun,
  skull: Skull,
  map: MapIcon,
  'scroll-text': ScrollText,
  package: Package,
  shield: Shield,
  swords: Swords,
  users: Users,
  sparkles: Sparkles,
  crown: Crown,
  check: Check,
  plus: Plus,
};

const meta = {
  title: 'Core/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  args: { icon: ListFilter, label: 'Filter (F)', variant: 'secondary', size: 36 },
  argTypes: {
    variant: { control: 'inline-radio', options: ['secondary', 'ghost', 'float', 'sunken'] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    size: { control: { type: 'range', min: 24, max: 56 } },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof IconButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Secondary: Story = {};
export const Active: Story = { args: { active: true } };
export const Float: Story = {
  args: { variant: 'float', icon: Sun, label: 'Toggle theme', size: 38 },
};
export const Ghost: Story = { args: { variant: 'ghost', icon: X, label: 'Close' } };
export const Sunken: Story = { args: { variant: 'sunken', size: 28, label: 'Move up' } };
export const SunkenDisabled: Story = {
  args: { variant: 'sunken', size: 28, label: 'Move up', disabled: true },
};
/** Close and clear buttons spin on hover instead of lifting. */
export const RoundClose: Story = {
  args: { variant: 'sunken', round: true, spin: true, icon: X, label: 'Clear selection' },
};
export const Toolbar: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <IconButton icon={ListFilter} label="Filter" active />
      <IconButton icon={SlidersHorizontal} label="Display" />
    </div>
  ),
};
