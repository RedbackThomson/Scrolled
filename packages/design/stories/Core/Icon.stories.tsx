import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowDownUp,
  Bookmark,
  BookmarkPlus,
  Check,
  Compass,
  Crown,
  House,
  ListFilter,
  Map as MapIcon,
  MapPin,
  Package,
  Pencil,
  Plus,
  Route,
  ScrollText,
  Settings,
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
import { Icon } from '../../src/components/core/Icon';

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
  title: 'Core/Icon',
  component: Icon,
  tags: ['autodocs'],
  args: { icon: Skull, size: 18 },
  argTypes: {
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    size: { control: { type: 'range', min: 10, max: 48 } },
    color: { control: 'color' },
  },
} satisfies Meta<typeof Icon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NavSet: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 14 }}>
      {[
        House,
        Package,
        Shield,
        Swords,
        Skull,
        Users,
        MapIcon,
        ScrollText,
        Sparkles,
        Bookmark,
        Settings,
        Compass,
      ].map((glyph, i) => (
        <Icon key={i} icon={glyph} size={18} />
      ))}
    </div>
  ),
};
export const Colored: Story = { args: { icon: Crown, size: 24, color: 'var(--gold)' } };
