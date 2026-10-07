import type { Meta, StoryObj } from '@storybook/react';
import { FlaskConical, Sword } from 'lucide-react';
import { EntityCard } from '../../src/components/entity/EntityCard';
import { Chip } from '../../src/components/core/Chip';

const wrap = [
  (Story: () => JSX.Element) => (
    <div style={{ width: 230 }}>
      <Story />
    </div>
  ),
];
const weapon = (name: string, atk: number, slots: number) => ({
  icon: Sword,
  tint: 'equip' as const,
  name,
  subtitle: 'One Handed Sword',
  stats: [
    { label: 'ATK', value: atk, color: 'var(--stat-hp)' },
    { label: 'Slots', value: slots },
    { label: 'Req Lv', value: 0 },
    { label: 'Req DEX', value: 0 },
  ],
  tags: ['Any class', 'Regular'],
});
const WEAPONS: [string, number, number][] = [
  ['Sword', 17, 7],
  ['Old Shortsword', 10, 0],
  ['Sky Parasol', 15, 7],
  ['Squeaky Hammer', 1, 7],
  ['Paper Blade', 19, 7],
  ['Leaf Banner', 1, 7],
  ['Harvest Basket', 1, 7],
  ['Starry Banner', 30, 7],
];

const meta = {
  title: 'Entity/EntityCard',
  component: EntityCard,
  tags: ['autodocs'],
  args: weapon('Sword', 17, 7),
  argTypes: {
    tint: { control: 'select', options: ['etc', 'use', 'equip', 'cash', 'mob', 'neutral'] },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof EntityCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Weapon: Story = { decorators: wrap };
export const SelectedWithBadge: Story = {
  decorators: wrap,
  args: {
    ...weapon('Gladius', 41, 7),
    selected: true,
    badge: (
      <Chip tone="hue" hue={330}>
        Cash
      </Chip>
    ),
  },
};
export const NoTags: Story = {
  decorators: wrap,
  args: { ...weapon('Sky Parasol', 15, 7), tags: [] },
};
export const Minimal: Story = {
  decorators: wrap,
  args: {
    icon: FlaskConical,
    tint: 'use',
    name: 'Blue Tonic',
    subtitle: 'Use · 100 coins',
    stats: [],
    tags: [],
  },
};
export const Grid: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 210px)', gap: 12 }}>
      {WEAPONS.map(([name, atk, slots]) => (
        <EntityCard key={name} {...weapon(name, atk, slots)} onClick={() => {}} />
      ))}
    </div>
  ),
};
