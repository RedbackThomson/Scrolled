import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
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
import { Button } from '../../src/components/core/Button';

const ICONS = {
  none: undefined,
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
const TRAILING_ICONS = {
  none: undefined,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'arrow-right': ArrowRight,
};

const meta = {
  title: 'Core/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Save', icon: BookmarkPlus, variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    iconRight: { control: 'select', options: Object.keys(TRAILING_ICONS), mapping: TRAILING_ICONS },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', icon: Pencil, children: 'Edit' } };
export const Ghost: Story = { args: { variant: 'ghost', icon: undefined, children: 'Cancel' } };
export const Danger: Story = { args: { variant: 'danger', icon: Trash2, children: 'Delete' } };
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
      <Button {...args} size="lg" icon={Route}>
        Get directions
      </Button>
    </div>
  ),
};
export const WithTrailingIcon: Story = {
  args: {
    variant: 'secondary',
    icon: Bookmark,
    iconRight: ChevronDown,
    children: 'Saved Searches',
  },
};
export const Disabled: Story = { args: { disabled: true } };
export const FullWidth: Story = {
  args: { fullWidth: true, size: 'lg', icon: undefined, children: 'Show 38 weapons' },
  decorators: [
    (Story) => (
      <div style={{ width: 340 }}>
        <Story />
      </div>
    ),
  ],
};
