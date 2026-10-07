import type { Meta, StoryObj } from '@storybook/react';
import {
  CreditCard,
  FlaskConical,
  Gem,
  Ghost,
  Map as MapIcon,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Users,
} from 'lucide-react';
import { SlotTile } from '../../src/components/entity/SlotTile';

const ICONS = {
  none: undefined,
  flask: FlaskConical,
  gem: Gem,
  sword: Sword,
  ghost: Ghost,
  map: MapIcon,
};
const HUES = [
  [Package, 70],
  [Shield, 235],
  [Skull, 20],
  [Users, 150],
  [MapIcon, 185],
  [ScrollText, 295],
  [Sparkles, 260],
] as const;

const meta = {
  title: 'Entity/SlotTile',
  component: SlotTile,
  tags: ['autodocs'],
  args: { icon: FlaskConical, tint: 'use', size: 36 },
  argTypes: {
    tint: { control: 'select', options: ['etc', 'use', 'equip', 'cash', 'mob', 'neutral'] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
    size: { control: { type: 'range', min: 24, max: 128 } },
    hue: { control: { type: 'range', min: 0, max: 360 } },
  },
} satisfies Meta<typeof SlotTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Sprite: Story = {};
export const IconTile: Story = { args: { icon: MapIcon, hue: 185 } };
export const PageHeader: Story = {
  args: { icon: Ghost, tint: 'mob', size: 116, spotlight: true, rimmed: true },
};
export const CategoryTints: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      <SlotTile icon={Gem} tint="etc" size={52} />
      <SlotTile icon={FlaskConical} tint="use" size={52} />
      <SlotTile icon={Sword} tint="equip" size={52} />
      <SlotTile icon={CreditCard} tint="cash" size={52} />
      <SlotTile icon={Ghost} tint="mob" size={52} />
    </div>
  ),
};
export const EntityHues: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10 }}>
      {HUES.map(([glyph, h]) => (
        <SlotTile key={h} icon={glyph} hue={h} size={44} />
      ))}
    </div>
  ),
};
export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
      {[28, 36, 52, 60, 96].map((s) => (
        <SlotTile key={s} icon={Sword} tint="equip" size={s} />
      ))}
    </div>
  ),
};
